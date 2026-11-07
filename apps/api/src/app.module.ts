/**
 * NestJS Root Application Module (Modular Monolith)
 * Organises all 21 domain modules with strict boundary separation.
 */
export class AppModule {
  static register() {
    return {
      module: AppModule,
      modules: [
        'AuthModule',
        'UsersModule',
        'FarmersModule',
        'ConsentModule',
        'LanguagesModule',
        'ReportsModule',
        'IncidentsModule',
        'CropDataModule',
        'FieldsModule',
        'InsuranceModule',
        'ConversationModule',
        'VoiceModule',
        'GnaniModule',
        'ExtractionModule',
        'ValidationModule',
        'PolicyModule',
        'EvidenceModule',
        'DocumentsModule',
        'NotificationsModule',
        'SubmissionRecordsModule',
        'AuditModule',
        'AdminModule',
        'HealthModule',
      ],
    };
  }
}
