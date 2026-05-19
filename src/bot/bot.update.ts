import { Update, Ctx, Start, On, Hears, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import axios from 'axios';

@Update()
export class BotUpdate {
    private waitingSearch = new Set<number>();
    private favoriteMovies = new Map<number, any[]>();

    // 🎬 Главное меню
    private mainMenu = {
        reply_markup: {
            keyboard: [
                ['🔍 Поиск', '🔥 Тренды'],
                ['⭐ Избранное', 'ℹ️ Помощь'],
                ['🎲 Случайный фильм'],
            ],
            resize_keyboard: true,
        },
    };

    private async getRandomMovie() {
        const url =
            `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_KEY}&language=ru-RU`;

        const res = await axios.get(url);

        const movies = res.data.results;

        return movies[Math.floor(Math.random() * movies.length)];
    }

    private async getTopTrailer(query: string) {
        const yt = await axios.get(
            'https://www.googleapis.com/youtube/v3/search',
            {
                params: {
                    part: 'snippet',
                    q: `${query} official trailer`,
                    key: process.env.YOUTUBE_KEY,
                    maxResults: 5,
                    type: 'video',
                },
            }
        );

        const items = yt.data.items;

        if (!items?.length) return null;

        const best = items[0];

        const videoId = best?.id?.videoId;

        return videoId
            ? `https://www.youtube.com/watch?v=${videoId}`
            : null;
    }


    @Action(/^trailer_(\d+)$/)
    async onTrailer(@Ctx() ctx: any) {
        await ctx.answerCbQuery();

        const movieId = ctx.match?.[1];
        if (!movieId) {
            return ctx.reply('❌ Не удалось получить ID фильма');
        }

        const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_KEY}&language=ru-RU`;

        let movie;

        try {
            const res = await axios.get(url);
            movie = res.data;
        } catch (err) {
            console.error('TMDB error:', err);
            return ctx.reply('❌ Ошибка получения данных о фильме');
        }

        const title = movie.title || movie.original_title;

        const trailer = await this.getTopTrailer(title);

        if (!trailer) {
            return ctx.reply('❌ Трейлер не найден');
        }

        await ctx.reply(
            `🎬 <b>${title}</b>\n\n🎞 <a href="${trailer}">Смотреть трейлер</a>`,
            { parse_mode: 'HTML' }
        );
    }


    // 🚀 START
    @Start()
    async start(@Ctx() ctx: Context) {
        await ctx.reply(
            `🎬 *Netflix Bot v2*

Добро пожаловать 👋
Выбери действие:`,
            {
                parse_mode: 'Markdown',
                ...this.mainMenu,
            },
        );
    }

    // 🔍 ПОИСК
    @Hears('🔍 Поиск')
    async search(@Ctx() ctx: Context) {
        this.waitingSearch.add(ctx.from!.id);
        await ctx.reply('🎬 Введи название фильма:');
    }

    // 🔥 ТРЕНДЫ
    @Hears('🔥 Тренды')
    async trending(@Ctx() ctx: Context) {
        const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${process.env.TMDB_KEY}&language=ru-RU`;

        const res = await axios.get(url);
        const movies = res.data.results.slice(0, 5);

        for (const movie of movies) {
            await this.sendMovieCard(ctx, movie);
        }
    }

    // ⭐ ИЗБРАННОЕ
    @Hears('⭐ Избранное')
    async favorites(@Ctx() ctx: Context) {
        const list = this.favoriteMovies.get(ctx.from!.id) || [];

        if (!list.length) {
            await ctx.reply('⭐️ Пока нет избранных фильмов\n\nДобавьте фильмы через кнопку ❤️');

            return
        }

        for (const movie of list) {
            await this.sendMovieCard(ctx, movie, true);
        }
    }

    // ℹ️ ПОМОЩЬ (УЛУЧШЕННАЯ)
    @Hears('ℹ️ Помощь')
    async help(@Ctx() ctx: Context) {
        await ctx.reply(`
🎬 Добро пожаловать Гандон

Доступные команды:

/search — поиск мужыка для секса
/random — случайный трах в жопу
/trending — популярные гей фильмы
/favorites — коллекция гейских фильмов

🍿 Используй кнопки меню для удоб... иди нахуй сам разберешься
`);
    }

    // 💬 ОБРАБОТКА ТЕКСТА (поиск)
    @On('text')
    async onText(@Ctx() ctx: Context) {



        const id = ctx.from!.id;

        const text =
            (ctx.message as any).text;

        // 🎲 случайный фильм
        if (text === '🎲 Случайный фильм') {

            const movie =
                await this.getRandomMovie();

            await this.sendMovieCard(
                ctx,
                movie
            );

            return;
        }

        // 🔎 если не режим поиска
        if (!this.waitingSearch.has(id)) {
            return;
        }

        this.waitingSearch.delete(id);

        const query = text;

        const url =
            `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_KEY}&query=${encodeURIComponent(query)}&language=ru-RU`;

        const res = await axios.get(url);

        const movie =
            res.data.results[0];

        if (!movie) {

            await ctx.reply(
                '❌ Фильм не найден'
            );

            return;
        }

        await this.sendMovieCard(
            ctx,
            movie
        );

        return;
    }

    // 🎬 КАРТОЧКА ФИЛЬМА (UX ядро)
    private async sendMovieCard(ctx: Context, movie: any, isFav = false) {
        const caption = `
🎬 *${movie.title}*

⭐ ${movie.vote_average != null ? movie.vote_average.toFixed(1) : '—'}/10
📅 ${movie.release_date ?? '—'}

📝 ${movie.overview?.slice(0, 200) ?? 'Нет описания'}...
`;

        const buttons = [
            [
                {
                    text: isFav ? '💔 Удалить' : '⭐ В избранное',
                    callback_data: isFav
                        ? `remove_${movie.id}`
                        : `fav_${movie.id}`,
                },
                { text: '🎞 Трейлер', callback_data: `trailer_${movie.id}` }
            ],
            [
                {
                    text: ' Инфо',
                    url: `https://www.themoviedb.org/movie/${movie.id}`
                }
            ]
        ];

        if (movie.poster_path) {
            await ctx.replyWithPhoto(
                `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
                {
                    caption,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'ℹ️ Инфо',
                                    url: `https://www.themoviedb.org/movie/${movie.id}`
                                }
                            ],
                            [
                                { text: '⭐ В избранное', callback_data: `fav_${movie.id}` },

                                { text: '🎞 Трейлер', callback_data: `trailer_${movie.id}` }


                                // {
                                //     text: '▶️ Смотреть трейлер',
                                //     url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
                                // }

                            ]
                        ],
                    },
                },
            );
        } else {
            await ctx.reply(caption, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: buttons,
                },
            });
        }
    }

    // 🎯 КНОПКИ (избранное)
    @On('callback_query')
    async onCallback(@Ctx() ctx: any) {
        const data = ctx.callbackQuery.data;

        if (!data) return;

        // ⭐ добавить в избранное
        if (data.startsWith('fav_')) {
            const movieId = data.replace('fav_', '');

            const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_KEY}&language=ru-RU`;

            const res = await axios.get(url);
            const movie = res.data;

            if (!movie || !movie.title) {
                return ctx.answerCbQuery('❌ Ошибка фильма');
            }

            const list = this.favoriteMovies.get(ctx.from.id) || [];

            const exists = list.some((m) => m.id === movie.id);
            if (!exists) list.push(movie);

            this.favoriteMovies.set(ctx.from.id, list);

            await ctx.answerCbQuery('⭐ Добавлено');

            return
        }

        // 💔 удалить
        if (data.startsWith('remove_')) {
            const movieId = data.replace('remove_', '');

            const list = this.favoriteMovies.get(ctx.from.id) || [];
            const newList = list.filter((m) => m.id != movieId);

            this.favoriteMovies.set(ctx.from.id, newList);

            await ctx.answerCbQuery('💔 Удалено');
            return;
        }

        // 🎬 ТРЕЙЛЕР
        if (data.startsWith('trailer_')) {
            const movieId = data.replace('trailer_', '');

            await ctx.answerCbQuery(); // обязательно

            const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_KEY}&language=ru-RU`;

            const res = await axios.get(url);
            const movie = res.data;

            const trailer = await this.getTopTrailer(movie.title);

            if (!trailer) {
                return ctx.reply('❌ Трейлер не найден');
            }

            await ctx.reply(
                `🎬 <b>${movie.title}</b>\n\n🎞 <a href="${trailer}">Смотреть трейлер</a>`,
                { parse_mode: 'HTML' }
            );

            return;
        }
    }
}