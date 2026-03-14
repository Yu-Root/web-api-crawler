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
  // ===== 智能去重相关字段 =====
  fingerprint: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '请求指纹，用于去重'
  },
  is_duplicate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为重复请求'
  },
  group_id: {
    type: DataTypes.STRING(36),
    allowNull: true,
    comment: '去重分组ID'
  },
  duplicate_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '重复次数'
  },
  // ===== 标签分类相关字段 =====
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '自动分类标签数组'
  },
  primary_tag: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '主要分类标签'
  },
  tag_confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: '标签置信度'
  },
  // ===== 依赖分析相关字段 =====
  dependencies: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '依赖的请求ID列表'
  },
  dependents: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '依赖本请求的ID列表'
  },
  dependency_level: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '依赖层级'
  },
  // ===== 性能监控相关字段 =====
  response_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '响应时间(ms)'
  },
  request_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '请求体大小(bytes)'
  },
  response_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '响应体大小(bytes)'
  },
  // ===== 元数据字段 =====
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '扩展元数据'
  }
}, {
  tableName: 'api_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['module_id']
    },
    {
      fields: ['fingerprint']
    },
    {
      fields: ['group_id']
    },
    {
      fields: ['primary_tag']
    },
    {
      fields: ['method']
    },
    {
      fields: ['status']
    }
  ]
});

// Define associations
Request.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });
Module.hasMany(Request, { foreignKey: 'module_id', as: 'requests' });

module.exports = Request;
