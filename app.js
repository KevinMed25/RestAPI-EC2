const express = require('express');
const app = express();
app.use(express.json());

let alumnos = [];
let profesores = [];

// Validaciones de los campos
function validarAlumno(data) {
    const { id, nombres, apellidos, matricula, promedio } = data;
    if (!id || typeof id !== 'number') return "ID inválido o vacío";
    if (!nombres || typeof nombres !== 'string') return "Nombres inválidos o vacíos";
    if (!apellidos || typeof apellidos !== 'string') return "Apellidos inválidos o vacíos";
    if (!matricula || typeof matricula !== 'string') return "Matrícula inválida o vacía";
    if (promedio === undefined || typeof promedio !== 'number') return "Promedio inválido o vacío";
    return null;
}

function validarProfesor(data) {
    const { id, numeroEmpleado, nombres, apellidos, horasClase } = data;
    if (!id || typeof id !== 'number') return "ID inválido o vacío";
    if (!numeroEmpleado || typeof numeroEmpleado !== 'number') return "Número de empleado inválido o vacío";
    if (!nombres || typeof nombres !== 'string') return "Nombres inválidos o vacíos";
    if (!apellidos || typeof apellidos !== 'string') return "Apellidos inválidos o vacíos";
    if (horasClase === undefined || typeof horasClase !== 'number') return "Horas de clase inválidas o vacías";
    return null;
}

// Definición de los endpoints para Alumnos
app.route('/alumnos')
    .get((req, res) => {
        res.status(200).json(alumnos);
    })
    .post((req, res, next) => {
        try {
            const error = validarAlumno(req.body);
            if (error) return res.status(400).json({ error });

            alumnos.push(req.body);
            res.status(201).json(req.body);
        } catch (err) {
            next(err);
        }
    });

app.route('/alumnos/:id')
    .get((req, res, next) => {
        try {
            const alumno = alumnos.find(a => a.id === parseInt(req.params.id));
            if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
            res.status(200).json(alumno);
        } catch (err) {
            next(err);
        }
    })
    .put((req, res, next) => {
        try {
            const index = alumnos.findIndex(a => a.id === parseInt(req.params.id));
            if (index === -1) return res.status(404).json({ error: "Alumno no encontrado" });

            const error = validarAlumno(req.body);
            if (error) return res.status(400).json({ error });

            alumnos[index] = req.body;
            res.status(200).json(req.body);
        } catch (err) {
            next(err);
        }
    })
    .delete((req, res, next) => {
        try {
            const index = alumnos.findIndex(a => a.id === parseInt(req.params.id));
            if (index === -1) return res.status(404).json({ error: "Alumno no encontrado" });

            alumnos.splice(index, 1);
            res.status(200).json({ message: "Alumno eliminado" });
        } catch (err) {
            next(err);
        }
    });

// Definición de los endpoints para Profesores
app.route('/profesores')
    .get((req, res) => {
        res.status(200).json(profesores);
    })
    .post((req, res, next) => {
        try {
            const error = validarProfesor(req.body);
            if (error) return res.status(400).json({ error });

            profesores.push(req.body);
            res.status(201).json(req.body);
        } catch (err) {
            next(err);
        }
    });

app.route('/profesores/:id')
    .get((req, res, next) => {
        try {
            const profesor = profesores.find(p => p.id === parseInt(req.params.id));
            if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });
            res.status(200).json(profesor);
        } catch (err) {
            next(err);
        }
    })
    .put((req, res, next) => {
        try {
            const index = profesores.findIndex(p => p.id === parseInt(req.params.id));
            if (index === -1) return res.status(404).json({ error: "Profesor no encontrado" });

            const error = validarProfesor(req.body);
            if (error) return res.status(400).json({ error });

            profesores[index] = req.body;
            res.status(200).json(req.body);
        } catch (err) {
            next(err);
        }
    })
    .delete((req, res, next) => {
        try {
            const index = profesores.findIndex(p => p.id === parseInt(req.params.id));
            if (index === -1) return res.status(404).json({ error: "Profesor no encontrado" });

            profesores.splice(index, 1);
            res.status(200).json({ message: "Profesor eliminado" });
        } catch (err) {
            next(err);
        }
    });

// Middleware para manejar métodos no permitidos en rutas existentes
app.use((req, res) => {
    if (['/alumnos', '/alumnos/:id', '/profesores', '/profesores/:id'].includes(req.path)) {
        res.status(405).json({ error: "Método no permitido" });
    } else {
        res.status(404).json({ error: "Ruta no encontrada" });
    }
});

// Middleware para manejo de errores 500
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
