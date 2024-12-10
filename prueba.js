const { S3Client, PutObjectCommand, ListObjectsCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
require('dotenv').config();


// Configurar cliente S3
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN, // Opcional
  },
});

// Función para subir archivo a S3
async function uploadFile(id, file) {
  const filename = `${id}_${file.name}`;
  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    Body: file.data,
  };

  const command = new PutObjectCommand(uploadParams);
  await client.send(command);

  return `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${filename}`;
}

// Prueba de carga de archivos
(async () => {
  try {
    // Simula un archivo de prueba
    const testFile = {
      name: "Reproducción_de_clase.png",
      data: fs.readFileSync("C:/Users/Kevin/OneDrive/Escritorio/AWS/RestAPI/RestAPI-EC2/Reproducción de clase.png"), // Asegúrate de que esta ruta sea válida
    };

    // ID único para la prueba
    const testId = "test-id-12345";

    // Llamar a la función uploadFile
    console.log("Subiendo archivo...");
    const uploadedUrl = await uploadFile(testId, testFile);

    console.log("Archivo subido correctamente:", uploadedUrl);

    // Verificar que el archivo exista en S3
    console.log("Verificando archivo en S3...");
    const bucketName = process.env.AWS_BUCKET_NAME;

    const listCommand = new ListObjectsCommand({
      Bucket: bucketName,
      Prefix: `${testId}_${testFile.name}`, // La misma ruta usada en Key
    });

    const response = await client.send(listCommand);

    // Validar que el archivo existe
    const exists = response.Contents?.some((item) => item.Key === `${testId}_${testFile.name}`);
    if (exists) {
      console.log("El archivo existe en S3. Prueba exitosa.");
    } else {
      console.error("El archivo no se encontró en S3. Prueba fallida.");
    }
  } catch (error) {
    console.error("Error durante la prueba:", error);
  }
})();
