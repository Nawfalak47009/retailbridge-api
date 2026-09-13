import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from './db';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private keepAliveTimer: NodeJS.Timeout | null = null;

  onModuleInit() {
    // Ping Neon database every 4 minutes to prevent auto-suspend / cold starts
    this.keepAliveTimer = setInterval(async () => {
      try {
        await db.execute(sql.raw('SELECT 1'));
      } catch (err: any) {
        this.logger.warn(`Keep-alive ping failed: ${err?.message}`);
      }
    }, 4 * 60 * 1000);

    // Initial ping
    db.execute(sql.raw('SELECT 1')).catch((err) => {
      this.logger.warn(`Initial database ping error: ${err?.message}`);
    });
  }

  onModuleDestroy() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
