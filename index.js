const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const mysql = require('mysql2');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Configuración de la conexión a la base de datos MySQL
const connection = mysql.createConnection({
  host: 'formvisitas.cy2rryebt90h.us-east-2.rds.amazonaws.com',
  port: 3306,
  user: 'formvisitas',
  password: 'Granjazul2023',
  database: 'Visitas',
});

// Establecer la conexión a la base de datos
connection.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
  }
});

// Rutas para registrar nuevos usuarios
app.post(
  '/api/register',
  [
    body('Nombre').notEmpty().withMessage('El nombre es obligatorio'),
    body('Correo').isEmail().withMessage('El correo electrónico debe ser una dirección de correo válida'),
    body('Contrasena').isLength({ min: 6 }).withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('RolId').isInt().withMessage('El ID del rol debe ser un número entero'),
    body('idgarita').isInt().withMessage('El ID de la garita debe ser un número entero'),
  ],
  (req, res) => {
    // Verificar si hay errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Obtener los datos del nuevo usuario desde el cuerpo de la solicitud
    const { Nombre, Correo, Area, Usuario, Contrasena, RolId, idgarita } = req.body;

    // Encriptar la contrasena antes de guardarla en la base de datos
    bcrypt.hash(Contrasena, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error al encriptar la contrasena:', err);
        return res.status(500).json({ error: 'Error al registrar el usuario' });
      }

      // Insertar los datos del usuario en la tabla "Usuario" en la base de datos
      const sql = `INSERT INTO Usuario (Nombre, Correo, Area, Usuario, Contrasena, RolId, idgarita) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      connection.query(sql, [Nombre, Correo, Area, Usuario, hashedPassword, RolId, idgarita], (err, result) => {
        if (err) {
          console.error('Error al registrar el usuario en la base de datos:', err);
          return res.status(500).json({ error: 'Error al registrar el usuario' });
        }

        return res.status(201).json({ message: 'Usuario registrado exitosamente' });
      });
    });
  }
);

// Ruta para iniciar sesión
app.post('/api/login', (req, res) => {
  // Obtener los datos del usuario que intenta iniciar sesión desde el cuerpo de la solicitud
  const { Usuario, Contrasena } = req.body;

  // Verificar que el usuario exista en la base de datos
  const sql = `SELECT * FROM Usuario WHERE Usuario = ?`;
  connection.query(sql, [Usuario], (err, results) => {
    if (err) {
      console.error('Error al verificar el usuario en la base de datos:', err);
      return res.status(500).json({ error: 'Error al iniciar sesión' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = results[0];

    // Verificar la contrasena encriptada
    bcrypt.compare(Contrasena, user.Contrasena, (error, isMatch) => {
      if (error) {
        console.error('Error al verificar la contrasena:', error);
        return res.status(500).json({ error: 'Error al iniciar sesión' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Si las credenciales son válidas, generar un token JWT
      const token = jwt.sign({ id: user.ID, RolId: user.RolId, idgarita: user.idgarita }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Duración del token (30 días)
      });

      return res.status(200).json({ token });
    });
  });
});

// Middleware de Autenticación
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  console.log('Token recibido en el backend:', token);

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token no proporcionado.' });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.log('Error al decodificar el token:', error);
    return res.status(401).json({ error: 'Acceso no autorizado. Token inválido.' });
  }
};


// Ruta para ingresar datos de visita
/*app.post('/api/datos-visita', authMiddleware, (req, res) => {
  // Obtener los datos de la visita desde el cuerpo de la solicitud
  const {
    IdArea,
    IdTipo,
    Nombre,
    Dpi,
    PlacasVehiculo,
    Procedencia,
    MotivoEntrada,
    FechaHoraLlegada,
    FechaHoraIngreso,
  } = req.body;

  // Obtener el ID del usuario autenticado desde el objeto de solicitud (req.user)
  const { id: idusuario, idgarita } = req.user; // Agregamos idgarita

  // Determinar el valor de IdEstado en función de las condiciones
  let IdEstado = 0; // Valor por defecto

  if (IdArea === 2 && (IdTipo === 1 || IdTipo === 2)) {
    IdEstado = 2; // Estado 2 si se cumplen las condiciones
  } else {
    IdEstado = 3; // Estado 3 en otros casos
  }

  // Insertar los datos de la visita en la tabla "DatosVisita" en la base de datos
  const sql = `
    INSERT INTO DatosVisita (
      IdArea, IdTipo, Nombre, Dpi, PlacasVehiculo, Procedencia,
      MotivoEntrada, FechaHoraLlegada, FechaHoraIngreso, IdEstado, idusuario, idgarita
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)  -- Agregamos idgarita
  `;

  connection.query(
    sql,
    [
      IdArea,
      IdTipo,
      Nombre,
      Dpi,
      PlacasVehiculo,
      Procedencia,
      MotivoEntrada,
      FechaHoraLlegada,
      FechaHoraIngreso,
      IdEstado,
      idusuario, // Agregamos el ID del usuario en sesión al campo idusuario
      idgarita,  // Agregamos el idgarita del usuario en sesión al campo idgarita
    ],
    (err, result) => {
      if (err) {
        console.error('Error al ingresar los datos de visita en la base de datos:', err);
        return res.status(500).json({ error: 'Error al ingresar los datos de visita' });
      }

      return res.status(201).json({ message: 'Datos de visita ingresados exitosamente' });
    }
  );
});*/



// Ruta para obtener datos de visitas del usuario logueado con IdEstado 1
app.get('/api/datosinicio', authMiddleware, (req, res) => {
  // Obtener el idgarita del usuario autenticado desde el objeto de solicitud (req.user)
  const { idgarita } = req.user;

  // Consultar los datos de visita con IdEstado 1 que coincidan con idgarita del usuario logueado
  const sql = `
    SELECT * FROM DatosVisita
    WHERE idgarita = ? AND IdEstado = 1
  `;

  connection.query(sql, [idgarita], (err, results) => {
    if (err) {
      console.error('Error al obtener los datos de visita de la base de datos:', err);
      return res.status(500).json({ error: 'Error al obtener los datos de visita' });
    }

    return res.status(200).json(results);
  });
});


// Ruta para obtener datos de visitas del usuario logueado con IdEstado 2 y idgarita = 3
app.get('/api/datosfabrica', authMiddleware, (req, res) => {
  // Obtener el ID del usuario autenticado desde el objeto de solicitud (req.user)
  const { idgarita } = req.user;

  const sql = `
    SELECT dv.*, df.*
    FROM DatosVisita dv
    LEFT JOIN DatosFabrica df ON dv.ID_Visita = df.IdVisita
    LEFT JOIN Usuario u ON dv.idusuario = u.ID
    WHERE dv.idgarita = ? AND dv.IdEstado = 2 AND u.idgarita = 3
  `;

  connection.query(sql, [idgarita], (err, results) => {
    if (err) {
      console.error('Error al obtener los datos de visita de la base de datos:', err);
      return res.status(500).json({ error: 'Error al obtener los datos de visita' });
    }

    return res.status(200).json(results);
  });
});



// Ruta para obtener datos de visitas del usuario logueado con IdEstado 3
app.get('/api/datossalida', authMiddleware, (req, res) => {
  // Obtener el ID del usuario autenticado desde el objeto de solicitud (req.user)
  const { idgarita } = req.user;

  // Consultar los datos de visita con IdEstado 1 que coincidan con idgarita del usuario logueado
  const sql = `
    SELECT * FROM DatosVisita
    WHERE idgarita = ? AND IdEstado = 3
  `;

  connection.query(sql, [idgarita], (err, results) => {
    if (err) {
      console.error('Error al obtener los datos de visita de la base de datos:', err);
      return res.status(500).json({ error: 'Error al obtener los datos de visita' });
    }

    return res.status(200).json(results);
  });
});



// Ruta protegida con autenticación
app.get('/api/usuarios', authMiddleware, (req, res) => {
  const { id: userId, RolId, idgarita } = req.user;

  if (RolId === 1) {
    const sql = `SELECT ID, Nombre, Correo, Area, Usuario, RolId, idgarita FROM Usuario`;
    connection.query(sql, (err, results) => {
      if (err) {
        console.error('Error al obtener información de usuarios:', err);
        return res.status(500).json({ error: 'Error al obtener información de usuarios' });
      }
      return res.status(200).json(results);
    });
  } else {
    const sql = `SELECT ID, Nombre, Correo, Area, Usuario, RolId, idgarita FROM Usuario WHERE ID = ?`;
    connection.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('Error al obtener información de usuario:', err);
        return res.status(500).json({ error: 'Error al obtener información de usuario' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json(results[0]);
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor en funcionamiento en el puerto ${PORT}`);
});


// Ruta para llenar la tabla DatosFabrica y actualizar el estado en DatosVisita
app.post('/api/fabrica/:idFormulario', authMiddleware, async (req, res) => {
  const idFormulario = req.params.idFormulario;
  const { id: userId } = req.user;
  const { ...fabricaData } = req.body;

  try {
    await connection.promise().beginTransaction();

    const sqlCheckExisting = `
      SELECT COUNT(*) AS rowCount
      FROM DatosFabrica
      WHERE IdVisita = ?
    `;

    const [checkResult] = await connection.promise().query(sqlCheckExisting, [idFormulario]);

    if (checkResult[0].rowCount > 0) {
      const sqlUpdate = `
        UPDATE DatosFabrica
        SET
          NoDocumento1 = ?,
          NoDocumento2 = ?,
          NoDocumento3 = ?,
          FechaHoraIngresoBascula = ?,
          Observaciones1 = ?,
          Observaciones2 = ?,
          IdDocumento = ?
        WHERE IdVisita = ?
      `;

      await connection.promise().query(sqlUpdate, [
        fabricaData.NoDocumento1,
        fabricaData.NoDocumento2,
        fabricaData.NoDocumento3,
        fabricaData.FechaHoraIngresoBascula,
        fabricaData.Observaciones1,
        fabricaData.Observaciones2,
        fabricaData.IdDocumento,
        idFormulario,
      ]);
    } else {
      const sqlInsert = `
        INSERT INTO DatosFabrica (
          NoDocumento1, NoDocumento2, NoDocumento3,
          FechaHoraIngresoBascula, Observaciones1,
          Observaciones2,
          IdDocumento, IdVisita
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.promise().query(sqlInsert, [
        fabricaData.NoDocumento1,
        fabricaData.NoDocumento2,
        fabricaData.NoDocumento3,
        fabricaData.FechaHoraIngresoBascula,
        fabricaData.Observaciones1,
        fabricaData.Observaciones2,
        fabricaData.IdDocumento,
        idFormulario,
      ]);
    }

    const sqlVisita = `
      UPDATE DatosVisita
      SET IdEstado = 2
      WHERE ID_Visita = ? 
    `;

    await connection.promise().query(sqlVisita, [idFormulario]);

    await connection.promise().commit();

    return res.status(201).json({ message: 'Datos de fabrica ingresados y estado actualizado exitosamente' });
  } catch (error) {
    await connection.promise().rollback();
    console.error('Error en la transacción:', error);
    return res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

///////////////////////////////////////////////////////////////////////////////////

// Ruta para actualizar FechaHoraSalida y cambiar IdEstado a 4
app.put('/api/actualizarsalida/:idVisita', authMiddleware, (req, res) => {
  const { idVisita } = req.params; // Obtener el ID de visita de los parámetros de la URL

  // Obtener el ID del usuario autenticado desde el objeto de solicitud (req.user)
  const { id: idusuario } = req.user;

  // Capturar la fecha y hora actual
  const FechaHoraSalida = new Date(); // Esto crea una nueva instancia con la fecha y hora actual

  // Actualizar los datos en la tabla "DatosVisita" en la base de datos
  const sql = `
    UPDATE DatosVisita
    SET FechaHoraSalida = ?,
        IdEstado = 4
    WHERE ID_Visita = ? AND idusuario = ?
  `;

  connection.query(
    sql,
    [FechaHoraSalida, idVisita, idusuario],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar los datos de visita en la base de datos:', err);
        return res.status(500).json({ error: 'Error al actualizar los datos de visita' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'No se encontró la visita para actualizar' });
      }

      return res.status(200).json({ message: 'Datos de visita actualizados exitosamente' });
    }
  );
});



////////////////////////////////////////Api Datos
app.post('/api/datos-visita', authMiddleware, (req, res) => {
  // Obtener los datos de la visita desde el cuerpo de la solicitud
  const {
    IdArea,
    IdTipo,
    Nombre,
    Dpi,
    PlacasVehiculo,
    Procedencia,
    MotivoEntrada,
    FechaHoraLlegada,
  } = req.body;

  // Obtener el ID del usuario autenticado desde el objeto de solicitud (req.user)
  const { id: idusuario, idgarita } = req.user; // Agregamos idgarita

  // Valor de estado fijo
  const IdEstado = 1;

  // Insertar los datos de la visita en la tabla "DatosVisita" en la base de datos
  const sql = `
    INSERT INTO DatosVisita (
      IdArea, IdTipo, Nombre, Dpi, PlacasVehiculo, Procedencia,
      MotivoEntrada, FechaHoraLlegada, IdEstado, idusuario, idgarita
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  connection.query(
    sql,
    [
      IdArea,
      IdTipo,
      Nombre,
      Dpi,
      PlacasVehiculo,
      Procedencia,
      MotivoEntrada,
      FechaHoraLlegada,
      IdEstado,
      idusuario,
      idgarita,
    ],
    (err, result) => {
      if (err) {
        console.error('Error al ingresar los datos de visita en la base de datos:', err);
        return res.status(500).json({ error: 'Error al ingresar los datos de visita' });
      }

      return res.status(201).json({ message: 'Datos de visita ingresados exitosamente' });
    }
  );
});


// Ruta para actualizar FechaHoraSalidaBascula en DatosFabrica
app.put('/api/actualizarfabrica/:idVisita', authMiddleware, (req, res) => {
  const { idVisita } = req.params; // Obtener el ID de visita de los parámetros de la URL

  // Obtener el ID del usuario autenticado desde el objeto de solicitud (req.user)
  const { id: idusuario } = req.user;

  // Capturar la fecha y hora actual
  const FechaHoraSalidaBascula = new Date(); // Esto crea una nueva instancia con la fecha y hora actual

  // Actualizar los datos en la tabla "DatosFabrica" en la base de datos
  const sqlFabrica = `
    UPDATE DatosFabrica
    SET FechaHoraSalidaBascula = ?
    WHERE IdVisita = ?
  `;

  connection.query(
    sqlFabrica,
    [FechaHoraSalidaBascula, idVisita, idusuario],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar los datos de fábrica en la base de datos:', err);
        return res.status(500).json({ error: 'Error al actualizar los datos de fábrica' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'No se encontró la fábrica para actualizar' });
      }

      // Después de actualizar DatosFabrica, actualizamos DatosVisita
      const sqlVisita = `
        UPDATE DatosVisita
        SET IdEstado = 3
        WHERE ID_Visita = ? AND idusuario = ?
      `;

      connection.query(
        sqlVisita,
        [idVisita, idusuario],
        (errVisita, resultVisita) => {
          if (errVisita) {
            console.error('Error al actualizar los datos de visita en la base de datos:', errVisita);
            return res.status(500).json({ error: 'Error al actualizar los datos de visita' });
          }

          if (resultVisita.affectedRows === 0) {
            return res.status(404).json({ error: 'No se encontró la visita para actualizar' });
          }

          return res.status(200).json({ message: 'Datos de fábrica y visita actualizados exitosamente' });
        }
      );
    }
  );
});


// Ruta para actualizar FechaHoraIngreso y cambiar IdEstado
app.put('/api/actualizaringreso/:idVisita', authMiddleware, (req, res) => {
  const { idVisita } = req.params; // Obtener el ID de visita de los parámetros de la URL
  const { id: idusuario } = req.user; // Obtener el ID del usuario autenticado

  // Capturar la fecha y hora actual para FechaHoraIngreso
  const FechaHoraIngreso = new Date(); // Esto crea una nueva instancia con la fecha y hora actual

  // Obtener los valores de IdArea e IdTipo desde la solicitud
  const { IdArea, IdTipo } = req.body; // Asumiendo que los valores están en el cuerpo de la solicitud

  // Validar los valores de IdArea e IdTipo para determinar IdEstado
  let IdEstado = 3; // Valor predeterminado

  if (IdArea === 2 && (IdTipo === 1 || IdTipo === 2)) {
    IdEstado = 2; // Cambiar a 2 si se cumplen las condiciones
  }

  // Actualizar los datos en la tabla "DatosVisita" en la base de datos
  const sql = `
    UPDATE DatosVisita
    SET FechaHoraIngreso = ?,
        IdEstado = ?
    WHERE ID_Visita = ? AND idusuario = ?
  `;

  connection.query(
    sql,
    [FechaHoraIngreso, IdEstado, idVisita, idusuario],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar los datos de visita en la base de datos:', err);
        return res.status(500).json({ error: 'Error al actualizar los datos de visita' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'No se encontró la visita para actualizar' });
      }

      return res.status(200).json({ message: 'Datos de visita actualizados exitosamente' });
    }
  );
});
