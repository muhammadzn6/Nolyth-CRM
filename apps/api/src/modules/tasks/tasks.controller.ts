import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticationError, NotificationsService, TasksService, ValidationError } from "@orbit/backend";
import { cancelTaskSchema, completeTaskSchema, createTaskSchema, taskListQuerySchema, updateTaskSchema, uuidSchema } from "@orbit/contracts";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } } };
function parse<T>(schema: Schema<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new ValidationError("The request payload is invalid", result.error.issues); return result.data; }
@Controller("tasks")
@UseGuards(IdentityGuard)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService, @Inject(NotificationsService) private readonly notifications: NotificationsService) {}
  @Get() list(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.tasks.list(this.actor(request), parse(taskListQuerySchema, query)); }
  @Post() async create(@Body() input: unknown, @Req() request: AuthenticatedRequest) { const task = await this.tasks.create(this.actor(request), parse(createTaskSchema, input)); if (task.assigneeId !== this.actor(request).id) await this.notifications.createInApp({ idempotencyKey: `task-assigned:${task.id}`, recipientUserId: task.assigneeId, title: "New task assigned", message: task.title, relatedEntityType: "task", relatedEntityId: task.id }); return task; }
  @Patch(":taskId") update(@Param("taskId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.tasks.update(this.actor(request), parse(uuidSchema, id), parse(updateTaskSchema, input)); }
  @Post(":taskId/complete") complete(@Param("taskId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { const value = parse(completeTaskSchema, input); return this.tasks.complete(this.actor(request), parse(uuidSchema, id), value.notes, value.expectedVersion); }
  @Post(":taskId/cancel") cancel(@Param("taskId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { const value = parse(cancelTaskSchema, input); return this.tasks.cancel(this.actor(request), parse(uuidSchema, id), value.reason, value.expectedVersion); }
  private actor(request: AuthenticatedRequest) { if (!request.actor) throw new AuthenticationError(); return request.actor; }
}
