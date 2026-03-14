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
    defaultValue: [],
    comment: 'Array of request IDs that this request depends on'
  },
  dependents: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of request IDs that depend on this request'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of tags for categorization'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Auto-detected category'
  },
  response_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Response time in milliseconds'
  },
  is_duplicate: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  duplicate_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1
  }
}, {
  tableName: 'api_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Request.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });
Module.hasMany(Request, { foreignKey: 'module_id', as: 'requests' });

module.exports = Request;
