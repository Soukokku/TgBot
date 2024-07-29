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
                    [{ text: 'Удалить куратора', callback_data: 'remove_curator' }],
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
                    [{ text: 'Удалить куратора', callback_data: 'remove_curator' }],
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        });
    };

    switch (data) {
        case 'add_group':
            bot.sendMessage(chatId, 'Введите имя группы для добавления:');
            userStates[chatId].state = 'add_group';
            break;
        case 'pending_groups':
            await groupController.getPendingGroups(chatId, bot);
            await returnToStartMenu();
            break;
        case 'complete_task_prompt':
            bot.sendMessage(chatId, 'Введите ID задачи для завершения:');
            userStates[chatId].state = 'complete_task';
            break;
        case 'back':
            const user = await db.User.findOne({ where: { telegram_id: chatId } });
            if (user) {
                await user.update({ group_id: null });
            }
            await returnToStartMenu();
            break;
        case 'remove_curator':
            bot.sendMessage(chatId, 'Введите @username (без @!) пользователя для удаления куратора:');
            userStates[chatId].state = 'remove_curator';
            break;
        default:
            if (data.startsWith('select_group_')) {
                const page = parseInt(data.split('_')[2]);
                await groupController.showActiveGroups(chatId, bot, page);
            } else if (data.startsWith('choose_group_')) {
                const selectedGroupId = parseInt(data.split('_')[2]);
                const user = await db.User.findOne({ where: { telegram_id: chatId } });
                if (user) {
                    await user.update({ group_id: selectedGroupId });
                    const group = await db.Group.findByPk(selectedGroupId);
                    const buttons = [
                        [{ text: `Задачи`, callback_data: `tasks_${user.id}` }],
                        [{ text: `Добавить задачу`, callback_data: `add_task_${user.id}` }],
                        [{ text: 'Назад', callback_data: 'back' }]
                    ];

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
            } else if (userStates[chatId] && userStates[chatId].role === 'admin') {
                switch (data) {
                    case 'assign_curator':
                        bot.sendMessage(chatId, 'Введите @username (без @!) пользователя для назначения куратором:');
                        userStates[chatId].state = 'assign_curator';
                        break;
                    case 'add_group_admin':
                        bot.sendMessage(chatId, 'Введите ID группы для активации:');
                        userStates[chatId].state = 'activate_group';
                        break;
                    case 'delete_group':
                        bot.sendMessage(chatId, 'Введите название группы для удаления:');
                        userStates[chatId].state = 'delete_group';
                        break;
                }
            }
            break;
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
                        [{ text: 'Удалить куратора', callback_data: 'remove_curator' }],
                        [{ text: 'Назад', callback_data: 'back' }]
                    ]
                }
            });
        };

        switch (state) {
            case 'add_group':
                await groupController.createGroup(chatId, text, bot);
                userStates[chatId] = {};
                await returnToStartMenu();
                break;
            case 'add_task_title':
                userStates[chatId].taskTitle = text;
                bot.sendMessage(chatId, 'Введите описание задачи:');
                userStates[chatId].state = 'add_task_description';
                break;
            case 'add_task_description':
                userStates[chatId].taskDescription = text;
                bot.sendMessage(chatId, 'Введите дату завершения задачи в формате ГГГГ-ММ-ДД:');
                userStates[chatId].state = 'add_task_due_date';
                break;
            case 'add_task_due_date':
                const enteredDate = new Date(text);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Set the time to midnight to only compare the date part
                
                if (isNaN(enteredDate.getTime())) {
                    bot.sendMessage(chatId, 'Неверный формат даты. Пожалуйста, введите дату в формате ГГГГ-ММ-ДД:');
                } else if (enteredDate < today) {
                    bot.sendMessage(chatId, 'Пожалуйста, введите действительную дату завершения задачи:');
                } else {
                    await taskController.createTask(chatId, userId, userStates[chatId].taskTitle, userStates[chatId].taskDescription, text, bot);
                    userStates[chatId] = {};
                    await returnToStartMenu();
                }
                break;
            case 'complete_task':
                await taskController.completeTask(chatId, parseInt(text), bot);
                userStates[chatId] = {};
                await returnToStartMenu();
                break;
            case 'activate_group':
                const groupToActivateId = parseInt(text);
                await groupController.activateGroup(chatId, groupToActivateId, bot);
                userStates[chatId] = {};
                await returnToAdminMenu();
                break;
            case 'delete_group':
                await groupController.deleteGroup(chatId, text, bot);
                userStates[chatId] = {};
                await returnToAdminMenu();
                break;
            case 'assign_curator':
                const username = text.trim();
                if (!username) {
                    bot.sendMessage(chatId, 'Введено пустое значение. Попробуйте еще раз:');
                    return;
                }
                bot.sendMessage(chatId, 'Введите ID группы для назначения куратора:');
                userStates[chatId].state = 'assign_curator_group';
                userStates[chatId].curatorUsername = username;
                break;
            case 'assign_curator_group':
                const groupIdToAssignCurator = parseInt(text);
                if (isNaN(groupIdToAssignCurator)) {
                    bot.sendMessage(chatId, 'Введённый ID группы некорректен. Попробуйте еще раз.');
                    return;
                }
                await userController.assignCurator(chatId, userStates[chatId].curatorUsername, groupIdToAssignCurator, bot);
                userStates[chatId] = {};
                await returnToAdminMenu();
                break;
            case 'remove_curator':
                const usernameToRemove = text.trim();
                if (!usernameToRemove) {
                    bot.sendMessage(chatId, 'Введено пустое значение. Попробуйте еще раз:');
                    return;
                }
                await userController.removeCuratorRole(chatId, usernameToRemove, bot);
                userStates[chatId] = {};
                await returnToAdminMenu();
                break;
        }
    }
});