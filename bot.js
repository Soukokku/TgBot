const TelegramBot = require('node-telegram-bot-api');
const token = '7461792381:AAEIKFHDNLwC17s_3bro-oHCT2JCJ1YP-FE';
const bot = new TelegramBot(token, { polling: true });
const moment = require('moment');
const cron = require('node-cron');

const groupController = require('./controllers/groupController');
const taskController = require('./controllers/taskController');
const userController = require('./controllers/userController');
const db = require('./models');

const userStates = {};

// Отправка начального меню
const sendStartMenu = async (chatId) => {
    const buttons = [
        [{ text: 'Добавить группу', callback_data: 'add_group' }],
        [{ text: 'Группы, что ожидают добавления', callback_data: 'pending_groups' }],
        [{ text: 'Выбрать группу', callback_data: 'select_active_group_0' }]
    ];

    bot.sendMessage(chatId, 'Привет! Какая группа вам нужна?', {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
    userStates[chatId].previousMenu = sendStartMenu;
}

//отправка меню группы
const sendGroupMenu = async (chatId, user) => {
    if (user && (user.role === 'admin' || user.role === 'curator')) {
        const group = await db.Group.findByPk(user.group_id);
        bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Разослать уведомления', callback_data: 'send_notifications'}],
                    [{text: 'Заявки на добавление задач', callback_data: 'getPendingTasks'}],
                    [{text: 'Задачи', callback_data: 'task_menu'}],
                    [{text: 'Добавить задачу', callback_data: 'add_task_menu'}],
                    [{text: 'Назад', callback_data: 'back_to_start'}]
                ]
            }
        });
        userStates[chatId].previousMenu = sendGroupMenu;
    } else {
        const group = await db.Group.findByPk(user.group_id);
        bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Задачи', callback_data: 'task_menu'}],
                    [{text: 'Добавить задачу', callback_data: 'add_task_menu'}],
                    [{text: 'Назад', callback_data: 'back_to_start'}]
                ]
            }
        });
        userStates[chatId].previousMenu = sendGroupMenu;
    }
};

// Отправка меню добавления задачи
const sendAddTaskMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Какую задачу вы хотите добавить?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Для себя', callback_data: 'add_task_personal' }],
                [{ text: 'Для группы', callback_data: 'add_task_group' }],
                [{ text: 'Назад', callback_data: 'back_to_group' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendAddTaskMenu;
}

// Отправка меню задач
const sendTaskMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Какие задачи вы бы хотели просмотреть?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Мои задачи', callback_data: 'my_tasks' }],
                [{ text: 'Задачи группы', callback_data: 'group_tasks' }],
                [{ text: 'Назад', callback_data: 'back_to_group' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendTaskMenu;
}

// Отправка меню администратора
const sendAdminMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Выберите действие администратора:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Назначить куратора', callback_data: 'assign_curator' }],
                [{ text: 'Активировать группу', callback_data: 'add_group_admin' }],
                [{ text: 'Удалить группу', callback_data: 'delete_group' }],
                [{ text: 'Удалить куратора', callback_data: 'remove_curator' }],
                [{ text: 'Назад', callback_data: 'back_to_start' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendAdminMenu;
}

// Отправка меню запросов задач
const sendTaskRequestMenu = async (chatId) => {
    try {
        const user = await db.User.findOne({ where: { telegram_id: chatId } });

        if (!user) {
            bot.sendMessage(chatId, 'Пользователь не найден.');
            return;
        }

        const tasks = await db.Task.findAll({
            where: {
                status: 'pending',
                is_personal: false,
                group_id: user.group_id
            }
        });

        if (tasks.length > 0) {
            for (const task of tasks) {
                bot.sendMessage(chatId, `Заявка на добавление задачи:\n\nЗаголовок: ${task.title}\nОписание: ${task.description}\nСрок: ${task.deadline}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Подтвердить', callback_data: `approve_task_${task.id}` }],
                            [{ text: 'Отклонить', callback_data: `reject_task_${task.id}` }],
                            [{ text: 'Назад', callback_data: 'back_to_group' }]
                        ]
                    }
                });
            }
            userStates[chatId].previousMenu = sendTaskRequestMenu;
        } else {
            bot.sendMessage(chatId, 'Нет заявок на добавление задач.');
        }
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Произошла ошибка при получении заявок на добавление задач.');
    }
};



bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    userStates[chatId] = {};

    await userController.addUser(telegramId, msg.from);

    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (user && user.group_id !== null) {
        await sendGroupMenu(chatId, user);
    } else {
        await sendStartMenu(chatId);
    }
});

bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (user && user.role === 'admin') {
        userStates[chatId] = { role: 'admin' };
        await sendAdminMenu(chatId);
    } else {
        bot.sendMessage(chatId, 'Ошибка доступа. Вы не администратор.');
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (!userStates[chatId]) {
        userStates[chatId] = {};
    }

    await bot.answerCallbackQuery(query.id);

    const user = await db.User.findOne({ where: { telegram_id: chatId } });

    if (!user) {
        bot.sendMessage(chatId, 'Пользователь не найден.');
        return;
    }

    if (data.startsWith('select_active_group_')) {
        const page = parseInt(data.split('_').pop());
        await groupController.showActiveGroups(chatId, bot, page);
        return;
    }

    if (data.startsWith('choose_group_')) {
        const groupId = parseInt(data.split('_').pop());
        await db.User.update({ group_id: groupId }, { where: { telegram_id: chatId } });
        const updatedUser = await db.User.findOne({ where: { telegram_id: chatId } });
        await sendGroupMenu(chatId, updatedUser);
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        return;
    }

    if (data.startsWith('approve_task_')) {
        const taskId = parseInt(data.split('_').pop());
        await db.Task.update({ status: 'active' }, { where: { id: taskId } });
        bot.sendMessage(chatId, 'Задача утверждена.');
        await sendTaskRequestMenu(chatId);
        return;
    }

    if (data.startsWith('reject_task_')) {
        const taskId = parseInt(data.split('_').pop());
        await db.Task.destroy({ where: { id: taskId } });
        bot.sendMessage(chatId, 'Задача отклонена.');
        await sendTaskRequestMenu(chatId);
        return;
    }

    switch (data) {
        case 'send_notifications':
            await sendPersonalNotifications();
            await sendGroupNotifications();
            bot.sendMessage(chatId, 'Уведомления успешно отправлены!');
            break;
        case 'add_group':
            bot.sendMessage(chatId, 'Введите имя группы для добавления:');
            userStates[chatId].state = 'add_group';
            break;
        case 'pending_groups':
            await groupController.getPendingGroups(chatId, bot);
            await sendStartMenu(chatId);
            break;
        case 'add_task_menu':
            await sendAddTaskMenu(chatId);
            break;
        case 'task_menu':
            await sendTaskMenu(chatId);
            break;
        case 'assign_curator':
            bot.sendMessage(chatId, 'Введите username пользователя для назначения куратором:');
            userStates[chatId].state = 'assign_curator_username';
            break;
        case 'back_to_start':
            await db.User.update({ group_id: null }, { where: { telegram_id: chatId } });
            await sendStartMenu(chatId);
            break;
        case 'back_to_group':
            await sendGroupMenu(chatId, user);
            break;
        case 'add_task_personal':
            bot.sendMessage(chatId, 'Введите название задачи:');
            userStates[chatId] = { state: 'add_task_personal_title', userId: user.id };
            break;
        case 'add_task_group':
            bot.sendMessage(chatId, 'Введите название задачи:');
            userStates[chatId] = { state: 'add_task_group_title', userId: user.id };
            break;
        case 'my_tasks':
            await taskController.getPersonalTasks(chatId, user.id, bot);
            break;
        case 'group_tasks':
            await taskController.getGroupTasks(chatId, user.id, bot);
            break;
        case 'getPendingTasks':
            await sendTaskRequestMenu(chatId);
            break;
        case 'add_group_admin':
            bot.sendMessage(chatId, 'Введите название группы для активации:');
            userStates[chatId].state = 'activate_group_name';
            break;
        case 'complete_task_prompt':
            bot.sendMessage(chatId, 'Введите ID задачи для завершения:');
            userStates[chatId].state = 'complete_task';
            break;
        case 'back_to_task_menu':
            await sendTaskMenu(chatId);
            break;
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (userStates[chatId]) {
        const state = userStates[chatId].state;
        const userId = userStates[chatId].userId;

        switch (state) {
            case 'add_group':
                await groupController.createGroup(chatId, text, bot);
                userStates[chatId].state = null;
                await sendStartMenu(chatId);
                break;
            case 'add_task_personal_title':
                userStates[chatId].taskTitle = text;
                bot.sendMessage(chatId, 'Введите описание задачи:');
                userStates[chatId].state = 'add_task_personal_description';
                break;
            case 'assign_curator_username':
                const group = await db.User.findOne({ where: { telegram_id: chatId } }).then(user => user.group_id);
                if (!group) {
                    bot.sendMessage(chatId, 'Вы не состоите в группе.');
                    break;
                }
                await userController.assignCurator(chatId, text, group, bot);
                userStates[chatId].state = null;
                await sendAdminMenu(chatId);
                break;
            case 'add_task_personal_description':
                userStates[chatId].taskDescription = text;
                bot.sendMessage(chatId, 'Введите дедлайн задачи (YYYY-MM-DD):');
                userStates[chatId].state = 'add_task_personal_deadline';
                break;
            case 'add_task_personal_deadline':
                if (isValidDate(text)) {
                    const deadline = moment(text);
                    if (deadline.isBefore(moment(), 'day')) {
                        bot.sendMessage(chatId, 'Дата не может быть в прошлом. Пожалуйста, введите корректную дату:');
                    } else {
                        userStates[chatId].taskDeadline = text;
                        await taskController.addPersonalTask(chatId, userId, userStates[chatId].taskTitle, userStates[chatId].taskDescription, userStates[chatId].taskDeadline, bot);
                        userStates[chatId] = {};
                    }
                } else {
                    bot.sendMessage(chatId, 'Некорректная дата. Пожалуйста, введите дату в формате YYYY-MM-DD:');
                }
                break;
            case 'add_task_group_title':
                userStates[chatId].taskTitle = text;
                bot.sendMessage(chatId, 'Введите описание задачи:');
                userStates[chatId].state = 'add_task_group_description';
                break;
            case 'add_task_group_description':
                userStates[chatId].taskDescription = text;
                bot.sendMessage(chatId, 'Введите дедлайн задачи (YYYY-MM-DD):');
                userStates[chatId].state = 'add_task_group_deadline';
                break;
            case 'add_task_group_deadline':
                if (isValidDate(text)) {
                    const deadline = moment(text);
                    if (deadline.isBefore(moment(), 'day')) {
                        bot.sendMessage(chatId, 'Дата не может быть в прошлом. Пожалуйста, введите корректную дату:');
                    } else {
                        userStates[chatId].taskDeadline = text;
                        await taskController.addGroupTask(chatId, userId, userStates[chatId].taskTitle, userStates[chatId].taskDescription, userStates[chatId].taskDeadline, bot);
                        userStates[chatId] = {};
                    }
                } else {
                    bot.sendMessage(chatId, 'Некорректная дата. Пожалуйста, введите дату в формате YYYY-MM-DD:');
                }
                break;
            case 'activate_group_name':
                await groupController.activateGroup(chatId, text, bot);
                userStates[chatId].state = null;
                await sendAdminMenu(chatId);
                break;
            case 'complete_task':
                const taskId = parseInt(text);
                if (isNaN(taskId)) {
                    bot.sendMessage(chatId, 'Некорректный ID задачи. Пожалуйста, введите корректный ID задачи.');
                } else {
                    await taskController.completeTask(chatId, taskId, bot);
                    userStates[chatId].state = null;
                }
                break;
        }
    }
});



const isValidDate = (dateString) => {
    return moment(dateString, 'YYYY-MM-DD', true).isValid();
}

const sendPersonalNotifications = async () => {
    const now = moment();
    const oneWeekLater = now.clone().add(7, 'days').format('YYYY-MM-DD');
    const threeDaysLater = now.clone().add(3, 'days').format('YYYY-MM-DD');

    // Уведомления за неделю до дедлайна
    const personalTasksWeek = await db.Task.findAll({
        where: {
            deadline: oneWeekLater,
            creator_id: { [db.Sequelize.Op.ne]: null },
        },
    });

    for (const task of personalTasksWeek) {
        const user = await db.User.findOne({ where: { id: task.creator_id } });
        if (user) {
            bot.sendMessage(user.telegram_id, `Напоминаем, что до дедлайна вашей задачи "${task.title}" осталась одна неделя.`);
        }
    }

    // Уведомления за три дня до дедлайна
    const personalTasksThreeDays = await db.Task.findAll({
        where: {
            deadline: { [db.Sequelize.Op.lte]: threeDaysLater },
            creator_id: { [db.Sequelize.Op.ne]: null },
        },
    });

    for (const task of personalTasksThreeDays) {
        const user = await db.User.findOne({ where: { id: task.creator_id } });
        if (user) {
            bot.sendMessage(user.telegram_id, `Напоминаем, что до дедлайна вашей задачи "${task.title}" осталось ${moment(task.deadline).diff(now, 'days')} дней.`);
        }
    }
};

const sendGroupNotifications = async () => {
    const now = moment();
    const oneWeekLater = now.clone().add(7, 'days').format('YYYY-MM-DD');
    const threeDaysLater = now.clone().add(3, 'days').format('YYYY-MM-DD');

    // Уведомления за неделю до дедлайна
    const groupTasksWeek = await db.Task.findAll({
        where: {
            deadline: oneWeekLater,
            group_id: { [db.Sequelize.Op.ne]: null },
        },
    });

    for (const task of groupTasksWeek) {
        const groupMembers = await db.User.findAll({ where: { group_id: task.group_id } });
        for (const user of groupMembers) {
            bot.sendMessage(user.telegram_id, `Напоминаем, что до дедлайна групповой задачи "${task.title}" осталась одна неделя.`);
        }
    }

    // Уведомления за три дня до дедлайна
    const groupTasksThreeDays = await db.Task.findAll({
        where: {
            deadline: { [db.Sequelize.Op.lte]: threeDaysLater },
            group_id: { [db.Sequelize.Op.ne]: null },
        },
    });

    for (const task of groupTasksThreeDays) {
        const groupMembers = await db.User.findAll({ where: { group_id: task.group_id } });
        for (const user of groupMembers) {
            bot.sendMessage(user.telegram_id, `Напоминаем, что до дедлайна групповой задачи "${task.title}" осталось ${moment(task.deadline).diff(now, 'days')} дней.`);
        }
    }
};

// Запуск задач по расписанию
cron.schedule('0 9 * * *', async () => {
    await sendPersonalNotifications();
    await sendGroupNotifications();
});
