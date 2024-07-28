module.exports = (sequelize, DataTypes) => {
    const Group = sequelize.define('Group', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        status: {
            type: DataTypes.ENUM('active', 'pending'),
            defaultValue: 'pending'
        }
    }, {
        tableName: 'groups',
        timestamps: false
    });

    Group.associate = (models) => {
        Group.hasMany(models.User, { foreignKey: 'group_id' });
        Group.hasMany(models.Task, { foreignKey: 'group_id' });
    };

    return Group;
};