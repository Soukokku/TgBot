module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        telegram_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true
        },
        group_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'groups',
                key: 'id'
            }
        },
        role: {
            allowNull: false,
            type: DataTypes.ENUM('student', 'curator', 'admin'),
            defaultValue: 'student'
        }
    }, {
        tableName: 'users',
        timestamps: false
    });

    User.associate = (models) => {
        User.belongsTo(models.Group, { foreignKey: 'group_id' });
        User.hasMany(models.Task, { foreignKey: 'creator_id' });
    };

    return User;
};
