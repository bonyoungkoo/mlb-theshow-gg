import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyzerModule } from './analyzer/analyzer.module';

@Module({
  imports: [AnalyzerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
