import { Module } from "@nestjs/common";
import { GoogleCalendarService, GoogleOAuthHttpProvider, type GoogleCalendarDatabase } from "@orbit/backend";
import { loadServerEnv } from "@orbit/config";
import { database } from "@orbit/database";

import { IdentityModule } from "../identity/identity.module";
import { CALENDAR_APP_BASE_URL_TOKEN, CalendarController } from "./calendar.controller";

const googleCalendarDatabase = database as unknown as GoogleCalendarDatabase;

@Module({
  imports: [IdentityModule],
  controllers: [CalendarController],
  providers: [
    {
      provide: CALENDAR_APP_BASE_URL_TOKEN,
      useFactory: () => loadServerEnv().appBaseUrl,
    },
    {
      provide: GoogleCalendarService,
      useFactory: () => {
        const env = loadServerEnv();
        return new GoogleCalendarService(googleCalendarDatabase, new GoogleOAuthHttpProvider(), env.googleCalendar);
      },
    },
  ],
  exports: [GoogleCalendarService],
})
export class CalendarModule {}
