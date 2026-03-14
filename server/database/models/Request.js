const { DataTypes } = require('sequelize');
const { sequelize } = require('../index');
const Module = require('./Module');

const Request = sequelize.define('Request', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  module_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'api_modules',
      key: 'id'
    }
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  headers: {
    type: DataTypes.JSON,
    allowNull: true
  },
  post_data: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  resource_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  timestamp: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  response_body: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  response_headers: {
    type: DataTypes.JSON,
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dependencies: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  dependents: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  dependency_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  navigation_order: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'api_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Define associations
Request.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });
Module.hasMany(Request, { foreignKey: 'module_id', as: 'requests' });

module.exports = Request;
