const express = require('express');
const app = express();
const { Alumno, Profesor } = require('./models');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config();
const AWS = require('aws-sdk');
const path = require("path");
const bodyParser = require("body-parser");

app.use(express.json());

// Validación de variables de entorno para AWS
if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !process.env.AWS_REGION ||
    !process.env.AWS_SESSION_TOKEN
) {
    console.error(
        "Faltan variables de entorno para configurar AWS. Verifica que AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN y AWS_REGION estén configuradas en el archivo .env."
    );
    process.exit(1);
}

if (!process.env.AWS_SNS_TOPIC_ARN) {
    console.error(
        "Falta la variable AWS_SNS_TOPIC_ARN en el archivo .env. Esta es necesaria para enviar notificaciones."
    );
    process.exit(1);
}

// Configuración común de AWS
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    region: process.env.AWS_REGION,
};

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
    },
});

// Configuración de SNS
const sns = new AWS.SNS(awsConfig);

// Configuración de DynamoDB
const dynamoDB = new AWS.DynamoDB.DocumentClient(awsConfig);

// Nombre de la tabla de sesiones
const DYNAMO_TABLE_NAME = 'sesiones-alumnos';

// Función para subir archivo a S3
async function uploadFileToS3(id, filePath, fileName) {
    const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${id}_${fileName}`,
        Body: fs.createReadStream(filePath),
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    return `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${id}_${fileName}`;
}

// VALIDACIÓN DE LOS CAMPOS
function validarAlumno(data) {
    const { nombres, apellidos, matricula, promedio } = data;
    if (!nombres || typeof nombres !== 'string') return "Nombres inválidos o vacíos";
    if (!apellidos || typeof apellidos !== 'string') return "Apellidos inválidos o vacíos";
    if (!matricula || typeof matricula !== 'string') return "Matrícula inválida o vacía";
    if (promedio === undefined || typeof promedio !== 'number') return "Promedio inválido o vacío";
    return null;
}

function validarProfesor(data) {
    const { numeroEmpleado, nombres, apellidos, horasClase } = data;
    if (!numeroEmpleado || typeof numeroEmpleado !== 'number') return "Número de empleado inválido o vacío";
    if (!nombres || typeof nombres !== 'string') return "Nombres inválidos o vacíos";
    if (!apellidos || typeof apellidos !== 'string') return "Apellidos inválidos o vacíos";
    if (horasClase === undefined || typeof horasClase !== 'number') return "Horas de clase inválidas o vacías";
    return null;
}

// DEFINICIÓN DE ENDPOINTS PARA ALUMNOS
// Obtener todos los alumnos
app.get('/alumnos', async (req, res, next) => {
    try {
        const alumnos = await Alumno.findAll();
        res.status(200).json(alumnos);
    } catch (err) {
        next(err);
    }
});

// Crear un nuevo alumno
app.post('/alumnos', async (req, res, next) => {
    try {
        const error = validarAlumno(req.body);
        if (error) return res.status(400).json({ error });

        const nuevoAlumno = await Alumno.create(req.body);
        res.status(201).json(nuevoAlumno);
    } catch (err) {
        next(err);
    }
});

// Obtener un alumno por ID
app.get('/alumnos/:id', async (req, res, next) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        res.status(200).json(alumno);
    } catch (err) {
        next(err);
    }
});

// Actualizar un alumno por ID
app.put('/alumnos/:id', async (req, res, next) => {
    try {
        const error = validarAlumno(req.body);
        if (error) return res.status(400).json({ error });

        const [actualizados] = await Alumno.update(req.body, { where: { id: req.params.id } });
        if (actualizados === 0) return res.status(404).json({ error: "Alumno no encontrado" });

        const alumnoActualizado = await Alumno.findByPk(req.params.id);
        res.status(200).json(alumnoActualizado);
    } catch (err) {
        next(err);
    }
});

// Eliminar un alumno por ID
app.delete('/alumnos/:id', async (req, res, next) => {
    try {
        const eliminados = await Alumno.destroy({ where: { id: req.params.id } });
        if (eliminados === 0) return res.status(404).json({ error: "Alumno no encontrado" });

        res.status(200).json({ message: "Alumno eliminado" });
    } catch (err) {
        next(err);
    }
});

// Middleware para manejar multipart/form-data manualmente
app.use(bodyParser.raw({ type: "multipart/form-data", limit: "10mb" }));

// Endpoint para subir foto de perfil
app.post("/alumnos/:id/fotoPerfil", async (req, res, next) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

    // Verifica que la solicitud contenga un archivo
    if (!req.headers["content-type"] || !req.headers["content-type"].startsWith("multipart/form-data")) {
      return res.status(400).json({ error: "El contenido debe ser multipart/form-data" });
    }

    // Crear directorio temporal
    const tempDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    // Escribir el archivo temporalmente
    const fileName = "fotoPerfil.jpg"; // Puedes obtener este valor dinámicamente si el cliente lo envía
    const tempFilePath = path.join(tempDir, fileName);

    fs.writeFileSync(tempFilePath, req.body);

    // Subir archivo a S3
    const fotoPerfilUrl = await uploadFileToS3(alumno.id, tempFilePath, fileName);

    // Actualizar URL en el registro del alumno
    await alumno.update({ fotoPerfilUrl });

    // Eliminar el archivo temporal
    fs.unlinkSync(tempFilePath);

    res.status(200).json({ message: "Foto de perfil actualizada", fotoPerfilUrl });
  } catch (err) {
    console.error("Error procesando archivo:", err);
    next(err);
  }
});

// ENPOINT PARA ENVIAR NOTIFICACIÓN
app.post('/alumnos/:id/email', async (req, res, next) => {
    try {
        // Obtener la información del alumno
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        // Mensaje para enviar
        const mensaje = `
        Información del Alumno:
        Nombre: ${alumno.nombres} ${alumno.apellidos}
        Matrícula: ${alumno.matricula}
        Promedio: ${alumno.promedio}
        `;

        // Publicar mensaje en SNS
        const params = {
            Message: mensaje,
            Subject: `Calificaciones de ${alumno.nombres}`,
            TopicArn: process.env.AWS_SNS_TOPIC_ARN, // Configurar tu ARN del topic en el archivo .env
        };

        await sns.publish(params).promise();

        res.status(200).json({ message: "Correo enviado exitosamente" });
    } catch (err) {
        next(err);
    }
});

//ENDPOINTS PARA LOGIN
// app.post('/alumnos/:id/session/login', async (req, res, next) => {
//     try {
//         const { password } = req.body;
//         if (!password) return res.status(400).json({ error: "La contraseña es requerida" });

//         const alumno = await Alumno.findByPk(req.params.id);
//         if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

//         if (alumno.password !== password) {
//             return res.status(400).json({ error: "Contraseña incorrecta" });
//         }

//         const sessionId = uuidv4();
//         const session = {
//             id: sessionId,
//             fecha: Date.now(),
//             alumnoId: alumno.id,
//             active: true,
//         };

//         await dynamoDB.put({
//             TableName: DYNAMO_TABLE_NAME,
//             Item: session,
//         }).promise();

//         res.status(200).json({ message: "Inicio de sesión exitoso", session });
//     } catch (err) {
//         next(err);
//     }
// });
// app.post('/alumnos/:id/session/login', async (req, res, next) => {
//     try {
//         const { password } = req.body;
//         if (!password) return res.status(400).json({ error: "La contraseña es requerida" });

//         const alumno = await Alumno.findByPk(req.params.id);
//         if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

//         if (alumno.password !== password) {
//             return res.status(400).json({ error: "Contraseña incorrecta" });
//         }

//         const sessionString = uuidv4();
//         const session = {
//             id: uuidv4(),
//             sessionString,
//             alumnoId: alumno.id,
//             active: true,
//             fecha: Date.now(),
//         };

//         await dynamoDB.put({
//             TableName: DYNAMO_TABLE_NAME,
//             Item: session,
//         }).promise();

//         res.status(200).json({ message: "Inicio de sesión exitoso", sessionString });
//     } catch (err) {
//         next(err);
//     }
// });
const crypto = require("crypto");

// Función para generar un string aleatorio de 128 caracteres
function generateSessionString() {
    return crypto.randomBytes(64).toString("hex"); // 64 bytes = 128 caracteres en formato hexadecimal
}

//ENDPOINTS PARA LOGIN
app.post('/alumnos/:id/session/login', async (req, res, next) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: "La contraseña es requerida" });

        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        if (alumno.password !== password) {
            return res.status(400).json({ error: "Contraseña incorrecta" });
        }

        // Generar sessionString de 128 caracteres
        const sessionString = generateSessionString();
        const session = {
            id: uuidv4(),
            sessionString,
            alumnoId: alumno.id,
            active: true,
            fecha: Date.now(),
        };

        await dynamoDB.put({
            TableName: DYNAMO_TABLE_NAME,
            Item: session,
        }).promise();

        res.status(200).json({ message: "Inicio de sesión exitoso", sessionString });
    } catch (err) {
        next(err);
    }
});

//ENDPOINT PARA VERIFICAR SESIÓN
// app.post('/alumnos/:id/session/verify', async (req, res, next) => {
//     try {
//         const { sessionId } = req.body;
//         if (!sessionId) return res.status(400).json({ error: "SessionId es requerido" });

//         const result = await dynamoDB.get({
//             TableName: DYNAMO_TABLE_NAME,
//             Key: { id: sessionId },
//         }).promise();

//         if (!result.Item || !result.Item.active) {
//             return res.status(400).json({ error: "Sesión inválida o inactiva" });
//         }

//         res.status(200).json({ message: "Sesión válida", session: result.Item });
//     } catch (err) {
//         next(err);
//     }
// });
app.post('/alumnos/:id/session/verify', async (req, res, next) => {
    try {
        const { sessionString } = req.body;
        if (!sessionString) return res.status(400).json({ error: "SessionString es requerido" });

        const result = await dynamoDB.scan({
            TableName: DYNAMO_TABLE_NAME,
            FilterExpression: "sessionString = :sessionString",
            ExpressionAttributeValues: {
                ":sessionString": sessionString,
            },
        }).promise();

        if (result.Items.length === 0 || !result.Items[0].active) {
            return res.status(400).json({ error: "Sesión inválida o inactiva" });
        }

        res.status(200).json({ message: "Sesión válida", session: result.Items[0] });
    } catch (err) {
        next(err);
    }
});



//ENDPOINT PARA LOGOUT
// app.post('/alumnos/:id/session/logout', async (req, res, next) => {
//     try {
//         const { sessionId } = req.body;
//         if (!sessionId) return res.status(400).json({ error: "SessionId es requerido" });

//         const params = {
//             TableName: DYNAMO_TABLE_NAME,
//             Key: { id: sessionId },
//             UpdateExpression: 'set active = :inactive',
//             ExpressionAttributeValues: {
//                 ':inactive': false,
//             },
//             ReturnValues: 'UPDATED_NEW',
//         };

//         const result = await dynamoDB.update(params).promise();
//         if (!result.Attributes) {
//             return res.status(400).json({ error: "Sesión no encontrada" });
//         }

//         res.status(200).json({ message: "Sesión cerrada correctamente" });
//     } catch (err) {
//         next(err);
//     }
// });
app.post('/alumnos/:id/session/logout', async (req, res, next) => {
    try {
        const { sessionString } = req.body;
        if (!sessionString) return res.status(400).json({ error: "SessionString es requerido" });

        const result = await dynamoDB.scan({
            TableName: DYNAMO_TABLE_NAME,
            FilterExpression: "sessionString = :sessionString",
            ExpressionAttributeValues: {
                ":sessionString": sessionString,
            },
        }).promise();

        if (result.Items.length === 0) {
            return res.status(400).json({ error: "Sesión no encontrada" });
        }

        const sessionId = result.Items[0].id;

        await dynamoDB.update({
            TableName: DYNAMO_TABLE_NAME,
            Key: { id: sessionId },
            UpdateExpression: "set active = :inactive",
            ExpressionAttributeValues: {
                ":inactive": false,
            },
            ReturnValues: "UPDATED_NEW",
        }).promise();

        res.status(200).json({ message: "Sesión cerrada correctamente" });
    } catch (err) {
        next(err);
    }
});



// DEFINICIÓN DE ENPOINTS PARA PROFESORES
// Obtener todos los profesores
app.get('/profesores', async (req, res, next) => {
    try {
        const profesores = await Profesor.findAll();
        res.status(200).json(profesores);
    } catch (err) {
        next(err);
    }
});

// Crear un nuevo profesor
app.post('/profesores', async (req, res, next) => {
    try {
        const error = validarProfesor(req.body);
        if (error) return res.status(400).json({ error });

        const nuevoProfesor = await Profesor.create(req.body);
        res.status(201).json(nuevoProfesor);
    } catch (err) {
        next(err);
    }
});

// Obtener un profesor por ID
app.get('/profesores/:id', async (req, res, next) => {
    try {
        const profesor = await Profesor.findByPk(req.params.id);
        if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

        res.status(200).json(profesor);
    } catch (err) {
        next(err);
    }
});

// Actualizar un profesor por ID
app.put('/profesores/:id', async (req, res, next) => {
    try {
        const error = validarProfesor(req.body);
        if (error) return res.status(400).json({ error });

        const [actualizados] = await Profesor.update(req.body, { where: { id: req.params.id } });
        if (actualizados === 0) return res.status(404).json({ error: "Profesor no encontrado" });

        const profesorActualizado = await Profesor.findByPk(req.params.id);
        res.status(200).json(profesorActualizado);
    } catch (err) {
        next(err);
    }
});

// Eliminar un profesor por ID
app.delete('/profesores/:id', async (req, res, next) => {
    try {
        const eliminados = await Profesor.destroy({ where: { id: req.params.id } });
        if (eliminados === 0) return res.status(404).json({ error: "Profesor no encontrado" });

        res.status(200).json({ message: "Profesor eliminado" });
    } catch (err) {
        next(err);
    }
});

// MIDDLEWARES
// Middleware para manejar métodos no permitidos en rutas existentes
app.use((req, res) => {
    const rutasPermitidas = [
        '/alumnos',
        '/alumnos/:id',
        '/profesores',
        '/profesores/:id',
        '/alumnos/:id/fotoPerfil',
        '/alumnos/:id/email',
        '/alumnos/:id/session/login',
        '/alumnos/:id/session/verify',
        '/alumnos/:id/session/logout'
    ];

    if (rutasPermitidas.includes(req.path)) {
        res.status(405).json({ error: "Método no permitido" });
    } else {
        res.status(404).json({ error: "Ruta no encontrada" });
    }
});

// Middleware para manejo de errores 500
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: "Error interno del servidor" });
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});