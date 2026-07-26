require('dotenv').config();
const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/creditflow';

const sequelize = new Sequelize(DATABASE_URL, {
  logging: false,
});

module.exports = {
  sequelize
};
