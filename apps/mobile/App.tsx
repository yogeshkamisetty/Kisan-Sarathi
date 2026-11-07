/**
 * Kisan Sarathi (किसान सारथी) Android Application Root
 * Connects offline SQLite store, Gnani voice proxy, and the 11-screen farmer workflow.
 */
import { FasalTheme } from './src/theme/colors';
import { UI_TRANSLATIONS } from './src/i18n/translations';
import { Screen01_LanguageSelection } from './src/screens/Screen01_LanguageSelection';
import { Screen02_WelcomeAndConsent } from './src/screens/Screen02_WelcomeAndConsent';
import { Screen03_FarmerOnboarding } from './src/screens/Screen03_FarmerOnboarding';
import { FarmerDashboardScreen } from './src/screens/FarmerDashboardScreen';
import { Screen04_StartCropLossReporting } from './src/screens/Screen04_StartCropLossReporting';
import { Screen05_AIConversation } from './src/screens/Screen05_AIConversation';
import { Screen06_InformationReview } from './src/screens/Screen06_InformationReview';
import { Screen07_VoiceReadback } from './src/screens/Screen07_VoiceReadback';
import { Screen08_ReportGeneration } from './src/screens/Screen08_ReportGeneration';
import { Screen09_OfficialReportingGuidance } from './src/screens/Screen09_OfficialReportingGuidance';
import { Screen10_OfficialReferenceEntry } from './src/screens/Screen10_OfficialReferenceEntry';
import { Screen11_FollowUpAndCompletion } from './src/screens/Screen11_FollowUpAndCompletion';

export const KisanSarathiMobileWorkflow = {
  theme: FasalTheme,
  translations: UI_TRANSLATIONS,
  screens: {
    Screen01_LanguageSelection,
    Screen02_WelcomeAndConsent,
    Screen03_FarmerOnboarding,
    FarmerDashboardScreen,
    Screen04_StartCropLossReporting,
    Screen05_AIConversation,
    Screen06_InformationReview,
    Screen07_VoiceReadback,
    Screen08_ReportGeneration,
    Screen09_OfficialReportingGuidance,
    Screen10_OfficialReferenceEntry,
    Screen11_FollowUpAndCompletion,
  },
};

export const FasalAwaazMobileWorkflow = KisanSarathiMobileWorkflow;

export default KisanSarathiMobileWorkflow;
