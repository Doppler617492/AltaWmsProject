import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PutawayService } from './putaway.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('putaway')
export class PutawayController {
  constructor(private svc: PutawayService) {}

  @Post('task')
  async createTask(@Body() body: any, @Req() req: any) {
    // RBAC left to existing guards; assume admin/sef will hit this
    return this.svc.createTask(body, req.user);
  }

  @Get('tasks/active')
  async active() {
    return this.svc.listActive();
  }

  @Patch('task/:id/reassign')
  async reassign(@Param('id') id: string, @Body() body: any) {
    return this.svc.reassign(Number(id), body.assigned_user_id);
  }

  @Get('my-tasks')
  async myTasks(@Req() req: any) {
    return this.svc.myTasks(req.user.id);
  }

  @Patch('task/:id/start')
  async start(@Param('id') id: string, @Req() req: any) {
    return this.svc.startTask(Number(id), req.user.id);
  }

  @Patch('task/:id/complete')
  async complete(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.completeTask(Number(id), req.user.id, body.actual_location_code, body.notes);
  }

  @Patch('task/:id/block')
  async block(@Param('id') id: string, @Body() body: any) {
    return this.svc.blockTask(Number(id), body.reason);
  }
}


