import { Module } from "@nestjs/common";
import { AuthorizationService, NotificationsService, TasksService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { IdentityModule } from "../identity/identity.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TasksController } from "./tasks.controller";
const tasksDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule, NotificationsModule], controllers: [TasksController], providers: [{ provide: TasksService, inject: [AuthorizationService], useFactory: (authorization: AuthorizationService) => new TasksService(tasksDatabase, authorization) }], exports: [TasksService] })
export class TasksModule {}
