const db = require('../models');

exports.getTasks = async (chatId, userId, bot) => {
    try {
        const user = await db.User.findByPk(userId);
        if (!user || user.group_id === null) {
            bot.sendMessage(chatId, 'Вы не принадлежите ни к одной группе.');
            return;
        }

        const tasks = await db.Task.findAll({ where: { group_id: user.group_id } });
        if (tasks.length === 0) {
            bot.sendMessage(chatId, 'В вашей группе пока нет задач.');
            return;
        }

        let taskList = 'Список задач:\n\n';
        tasks.forEach(task => {
            taskList += `ID: ${task.id}\nНазвание: ${task.title}\nОписание: ${task.description}\nДедлайн: ${task.deadline}\n\n`;
        });

        bot.sendMessage(chatId, taskList, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Завершить задачу', callback_data: `complete_task_prompt` }]
                ]
            }
        });
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при получении задач.');
        console.error(error);
    }
};

exports.createTask = async (chatId, userId, taskTitle, taskDescription, taskDeadline, bot) => {
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
            group_id: user.group_id,
            status: 'pending'
        };

        const newTask = await db.Task.create(taskData);
        bot.sendMessage(chatId, `Задача "${newTask.title}" успешно создана.`);
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при создании задачи.');
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
