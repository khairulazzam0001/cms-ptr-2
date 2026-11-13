import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AssessmentDataService } from './assessment-data.service';
import {
  ActivityQueryDto,
  ActorQueryDto,
  ChatQueryDto,
  CreateActivityDto,
  CreateActorDto,
  CreateChatDto,
  CreateEmailDto,
  CreateScenarioActivityDto,
  EmailQueryDto,
  ScenarioActivityQueryDto,
  UpdateActivityDto,
  UpdateActorDto,
  UpdateChatDto,
  UpdateEmailDto,
  UpdateScenarioActivityDto,
} from './dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private svc: AssessmentDataService) {}
  @Get() list(@Query() q: ActivityQueryDto) { return this.svc.activityList(q); }
  @Get('options/all') options() { return this.svc.activityOptions(); }
  @Post() create(@Body() dto: CreateActivityDto) { return this.svc.activityCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateActivityDto) { return this.svc.activityUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.activityRemove(id); }
}

@Controller('scenario-activities')
export class ScenarioActivitiesController {
  constructor(private svc: AssessmentDataService) {}
  @Get() list(@Query() q: ScenarioActivityQueryDto) { return this.svc.scenarioList(q); }
  @Post() create(@Body() dto: CreateScenarioActivityDto) { return this.svc.scenarioCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateScenarioActivityDto) { return this.svc.scenarioUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.scenarioRemove(id); }
}

@Controller('chats')
export class ChatsController {
  constructor(private svc: AssessmentDataService) {}
  @Get() list(@Query() q: ChatQueryDto) { return this.svc.chatList(q); }
  @Post() create(@Body() dto: CreateChatDto) { return this.svc.chatCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateChatDto) { return this.svc.chatUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.chatRemove(id); }
}

@Controller('emails')
export class EmailsController {
  constructor(private svc: AssessmentDataService) {}
  @Get() list(@Query() q: EmailQueryDto) { return this.svc.emailList(q); }
  @Post() create(@Body() dto: CreateEmailDto) { return this.svc.emailCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateEmailDto) { return this.svc.emailUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.emailRemove(id); }
}

// Dropdown referensi (dipakai form Activity / Scenario / Chat / Email)
@Controller('activity-types')
export class ActivityTypesController {
  constructor(private svc: AssessmentDataService) {}
  @Get('options/all') options() { return this.svc.activityTypeOptions(); }
}

@Controller('actors')
export class ActorsController {
  constructor(private svc: AssessmentDataService) {}
  @Get() list(@Query() q: ActorQueryDto) { return this.svc.actorList(q); }
  @Get('options/all') options() { return this.svc.actorOptions(); }
  @Post() create(@Body() dto: CreateActorDto) { return this.svc.actorCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateActorDto) { return this.svc.actorUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.actorRemove(id); }
}

@Controller('prompts')
export class PromptsController {
  constructor(private svc: AssessmentDataService) {}
  @Get('options/all') options() { return this.svc.promptOptions(); }
}
