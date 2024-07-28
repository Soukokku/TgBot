const TelegramBot = require('node-telegram-bot-api');
const token = '7461792381:AAEIKFHDNLwC17s_3bro-oHCT2JCJ1YP-FE';
const bot = new TelegramBot(token, { polling: true });

const groupController = require('./controllers/groupController');
const taskController = require('./controllers/taskController');
const userController = require('./controllers/userController');
const db = require('./models');

const userStates = {};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    userStates[chatId] = {};

    await userController.addUser(telegramId, msg.from);

    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (user && user.group_id !== null) {
        const group = await db.Group.findByPk(user.group_id);
        const buttons = [
            [{ text: `Задачи`, callback_data: `tasks_${user.id}` }],
            [{ text: `Добавить задачу`, callback_data: `add_task_${user.id}` }],
            [{ text: 'Назад', callback_data: 'back' }]
        ];

        if (user.role === 'admin') {
            buttons.unshift([{ text: 'Добавить группу', callback_data: 'add_group_admin' }]);
        }

        bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    } else {
        const buttons = [
            [{ text: 'Добавить группу', callback_data: 'add_group' }],
            [{ text: 'Группы, что ожидают добавления', callback_data: 'pending_groups' }],
            [{ text: 'Выбрать группу', callback_data: 'select_group_0' }]
        ];

        bot.sendMessage(chatId, 'Привет! Какая группа вам нужна?', {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }
});

bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (user && user.role === 'admin') {
        userStates[chatId] = { role: 'admin' };
        bot.sendMessage(chatId, 'Выберите действие администратора:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назначить куратора', callback_data: 'assign_curator' }],
                    [{ text: 'Активировать группу', callback_data: 'add_group_admin' }],
                    [{ text: 'Удалить группу', callback_data: 'delete_group' }],
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        });
    } else {
        bot.sendMessage(chatId, 'Ошибка доступа. Вы не администратор.');
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (!userStates[chatId]) {
        userStates[chatId] = {};
    }

    await bot.answerCallbackQuery(query.id);

    const returnToStartMenu = async () => {
        const user = await db.User.findOne({ where: { telegram_id: chatId } });
        if (user && user.group_id !== null) {
            const group = await db.Group.findByPk(user.group_id);
            const buttons = [
                [{ text: `Задачи`, callback_data: `tasks_${user.id}` }],
                [{ text: `Добавить задачу`, callback_data: `add_task_${user.id}` }],
                [{ text: 'Назад', callback_data: 'back' }]
            ];

            if (user.role === 'admin') {
                buttons.unshift([{ text: 'Добавить группу', callback_data: 'add_group_admin' }]);
            }

            bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
                reply_markup: {
                    inline_keyboard: buttons
                }
            });
        } else {
            const buttons = [
                [{ text: 'Добавить группу', callback_data: 'add_group' }],
                [{ text: 'Группы, что ожидают добавления', callback_data: 'pending_groups' }],
                [{ text: 'Выбрать группу', callback_data: 'select_group_0' }]
            ];

            bot.sendMessage(chatId, 'Привет! Какая группа вам нужна?', {
                reply_markup: {
                    inline_keyboard: buttons
                }
            });
        }
    };

    const returnToAdminMenu = async () => {
        await bot.sendMessage(chatId, 'Выберите действие администратора:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назначить куратора', callback_data: 'assign_curator' }],
                    [{ text: 'Активировать группу', callback_data: 'add_group_admin' }],
                    [{ text: 'Удалить группу', callback_data: 'delete_group' }],
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        });
    };

    if (data === 'add_group') {
        bot.sendMessage(chatId, 'Введите имя группы для добавления:');
        userStates[chatId].state = 'add_group';
    } else if (data === 'pending_groups') {
        await groupController.getPendingGroups(chatId, bot);
        await returnToStartMenu();
    } else if (data.startsWith('select_group_')) {
        const page = parseInt(data.split('_')[2]);
        await groupController.showActiveGroups(chatId, bot, page);
    } else if (data.startsWith('choose_group_')) {
        const groupId = parseInt(data.split('_')[2]);
        const user = await db.User.findOne({ where: { telegram_id: chatId } });
        if (user) {
            await user.update({ group_id: groupId });
            const group = await db.Group.findByPk(groupId);
            const buttons = [
                [{ text: `Задачи`, callback_data: `tasks_${user.id}` }],
                [{ text: `Добавить задачу`, callback_data: `add_task_${user.id}` }],
                [{ text: 'Назад', callback_data: 'back' }]
            ];

            if (user.role === 'admin') {
                buttons.unshift([{ text: 'Добавить группу', callback_data: 'add_group_admin' }]);
            }

            bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
                reply_markup: {
                    inline_keyboard: buttons
                }
            });
        }
    } else if (data.startsWith('tasks_')) {
        const userId = data.split('_')[1];
        await taskController.getTasks(chatId, userId, bot);
    } else if (data.startsWith('add_task_')) {
        const userId = data.split('_')[2];
        bot.sendMessage(chatId, 'Введите название задачи:');
        userStates[chatId].state = 'add_task_title';
        userStates[chatId].userId = userId;
    } else if (data === 'complete_task_prompt') {
        bot.sendMessage(chatId, 'Введите ID задачи для завершения:');
        userStates[chatId].state = 'complete_task';
    } else if (data === 'back') {
        await returnToStartMenu();
    } else if (userStates[chatId] && userStates[chatId].role === 'admin') {
        if (data === 'assign_curator') {
            bot.sendMessage(chatId, 'Введите @username (без @!) пользователя для назначения куратором:');
            userStates[chatId].state = 'assign_curator';
        } else if (data === 'add_group_admin') {
            bot.sendMessage(chatId, 'Введите ID группы для активации:');
            userStates[chatId].state = 'activate_group';
        } else if (data === 'delete_group') {
            bot.sendMessage(chatId, 'Введите название группы для удаления:');
            userStates[chatId].state = 'delete_group';
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const telegramId = msg.from.id;

    if (userStates[chatId]) {
        const state = userStates[chatId].state;
        const userId = userStates[chatId].userId;

        const returnToStartMenu = async () => {
            const user = await db.User.findOne({ where: { telegram_id: chatId } });
            if (user && user.group_id !== null) {
                const group = await db.Group.findByPk(user.group_id);
                const buttons = [
                    [{ text: `Задачи`, callback_data: `tasks_${user.id}` }],
                    [{ text: `Добавить задачу`, callback_data: `add_task_${user.id}` }],
                    [{ text: 'Назад', callback_data: 'back' }]
                ];

                if (user.role === 'admin') {
                    buttons.unshift([{ text: 'Добавить группу', callback_data: 'add_group_admin' }]);
                }

                bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
                    reply_markup: {
                        inline_keyboard: buttons
                    }
                });
            } else {
                const buttons = [
                    [{ text: 'Добавить группу', callback_data: 'add_group' }],
                    [{ text: 'Группы, что ожидают добавления', callback_data: 'pending_groups' }],
                    [{ text: 'Выбрать группу', callback_data: 'select_group_0' }]
                ];

                bot.sendMessage(chatId, 'Привет! Какая группа вам нужна?', {
                    reply_markup: {
                        inline_keyboard: buttons
                    }
                });
            }
        };

        const returnToAdminMenu = async () => {
            await bot.sendMessage(chatId, 'Выберите действие администратора:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назначить куратора', callback_data: 'assign_curator' }],
                        [{ text: 'Активировать группу', callback_data: 'add_group_admin' }],
                        [{ text: 'Удалить группу', callback_data: 'delete_group' }],
                        [{ text: 'Назад', callback_data: 'back' }]
                    ]
                }
            });
        };

        if (state === 'add_group') {
            await groupController.createGroup(chatId, text, bot);
            userStates[chatId] = {};
            await returnToStartMenu();
        } else if (state === 'add_task_title') {
            userStates[chatId].taskTitle = text;
            bot.sendMessage(chatId, 'Введите описание задачи:');
            userStates[chatId].state = 'add_task_description';
        } else if (state === 'add_task_description') {
            userStates[chatId].taskDescription = text;
            bot.sendMessage(chatId, 'Введите дату завершения задачи в формате ГГГГ-ММ-ДД:');
            userStates[chatId].state = 'add_task_due_date';
        } else if (state === 'add_task_due_date') {
            await taskController.addTask(chatId, userId, userStates[chatId].taskTitle, userStates[chatId].taskDescription, text, bot);
            userStates[chatId] = {};
            await returnToStartMenu();
        } else if (state === 'complete_task') {
            await taskController.completeTask(chatId, parseInt(text), bot);
            userStates[chatId] = {};
            await returnToStartMenu();
        } else if (state === 'activate_group') {
            const groupId = parseInt(text);
            await groupController.activateGroup(chatId, groupId, bot);
            userStates[chatId] = {};
            await returnToAdminMenu();
        } else if (state === 'delete_group') {
            await groupController.deleteGroup(chatId, text, bot);
            userStates[chatId] = {};
            await returnToAdminMenu();
        } else if (state === 'assign_curator') {
            const username = text.trim();
            if (!username) {
                bot.sendMessage(chatId, 'Введено пустое значение. Попробуйте еще раз:');
                return;
            }
            bot.sendMessage(chatId, 'Введите ID группы для назначения куратора:');
            userStates[chatId].state = 'assign_curator_group';
            userStates[chatId].curatorUsername = username;
        } else if (state === 'assign_curator_group') {
            const groupId = parseInt(text);
            if (isNaN(groupId)) {
                bot.sendMessage(chatId, 'Введённый ID группы некорректен. Попробуйте еще раз.');
                return;
            }
            await userController.assignCurator(chatId, userStates[chatId].curatorUsername, groupId, bot);
            userStates[chatId] = {};
            await returnToAdminMenu();
        }
    }
});

bot.setMyCommands([
    { command: '/start', description: 'Начало работы с ботом' },
    { command: '/admin', description: 'Режим администратора' }
]);
