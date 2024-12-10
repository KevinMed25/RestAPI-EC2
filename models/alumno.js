'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Alumno extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Alumno.init({
    nombres: DataTypes.STRING,
    apellidos: DataTypes.STRING,
    matricula: DataTypes.STRING,
    promedio: DataTypes.FLOAT,
    fotoPerfilUrl: DataTypes.STRING,
    password: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Alumno',
  });
  return Alumno;
};