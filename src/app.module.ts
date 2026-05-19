import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotUpdate } from './bot/bot.update';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN!,
    })
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate],
})
export class AppModule {}
