const db = require('../models');

exports.getPersonalTasks = async (chatId, userId, bot) => {
    try {
        const tasks = await db.Task.findAll({ where: { creator_id: userId, is_personal: true } });
        if (tasks.length === 0) {
            bot.sendMessage(chatId, 'У вас пока нет персональных задач.');
            return;
        }

        let taskList = 'Список персональных задач:\n\n';
        tasks.forEach(task => {
            taskList += `ID: ${task.id}\nНазвание: ${task.title}\nОписание: ${task.description}\nДедлайн: ${task.deadline}\n\n`;
        });

        bot.sendMessage(chatId, taskList, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Завершить задачу', callback_data: `complete_task_prompt` }],
                    [{ text: 'назад', callback_data: `back_to_task_menu` }]
                ]
            }
        });
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при получении персональных задач.');
        console.error(error);
    }
};

exports.getGroupTasks = async (chatId, userId, bot) => {
    try {
        const user = await db.User.findByPk(userId);
        if (!user || user.group_id === null) {
            bot.sendMessage(chatId, 'Вы не принадлежите ни к одной группе.');
            return;
        }

        const tasks = await db.Task.findAll({
            where: {
                group_id: user.group_id,
                is_personal: false,
                status: 'active'
            }
        });

        if (tasks.length === 0) {
            bot.sendMessage(chatId, 'В вашей группе пока нет задач.');
            return;
        }

        let taskList = 'Список активных групповых задач:\n\n';
        tasks.forEach(task => {
            taskList += `ID: ${task.id}\nНазвание: ${task.title}\nОписание: ${task.description}\nДедлайн: ${task.deadline}\n\n`;
        });

        bot.sendMessage(chatId, taskList, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Завершить задачу', callback_data: `complete_task_prompt` }],
                    [{ text: 'назад', callback_data: `back_to_task_menu` }]
                ]
            }
        });
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при получении групповых задач.');
        console.error(error);
    }
};

exports.addPersonalTask = async (chatId, userId, taskTitle, taskDescription, taskDeadline, bot) => {
    try {
        const user = await db.User.findByPk(userId);
        if (!user) {
            bot.sendMessage(chatId, 'Пользователь не найден.');
            return;
        }

        const taskData = {
            title: taskTitle,
            description: taskDescription,
            deadline: taskDeadline,
            is_personal: true,
            creator_id: userId,
            status: 'active'
        };

        const newTask = await db.Task.create(taskData);
        bot.sendMessage(chatId, `Персональная задача "${newTask.title}" успешно создана.`);
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при создании персональной задачи.');
        console.error(error);
    }
};

exports.addGroupTask = async (chatId, userId, taskTitle, taskDescription, taskDeadline, bot) => {
    try {
        const user = await db.User.findByPk(userId);
        if (!user || user.group_id === null) {
            bot.sendMessage(chatId, 'Вы не принадлежите ни к одной группе.');
            return;
        }

        const taskData = {
            title: taskTitle,
            description: taskDescription,
            deadline: taskDeadline,
            is_personal: false,
            group_id: user.group_id,
            creator_id: userId,
            status: 'pending'
        };

        const newTask = await db.Task.create(taskData);
        bot.sendMessage(chatId, `Групповая задача "${newTask.title}" отправлена на подтверждение.`);
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при создании групповой задачи.');
        console.error(error);
    }
};


exports.completeTask = async (chatId, taskId, bot) => {
    try {
        const task = await db.Task.findByPk(taskId);
        if (!task) {
            bot.sendMessage(chatId, 'Задача не найдена.');
            return;
        }

        await task.destroy();
        bot.sendMessage(chatId, `Задача с ID: ${taskId} завершена.`);
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при удалении задачи.');
        console.error(error);
    }
};
