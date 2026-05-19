import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotUpdate } from './bot/bot.update';

const token = process.env.TOKEN;

if (!token) {
  throw new Error('TOKEN is missing');
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegrafModule.forRoot({
      token,
    })
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate],
})
export class AppModule { }
