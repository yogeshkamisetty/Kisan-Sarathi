/**
 * Applicable Deadline & 7-Day Completion Reminder Engine
 * Only generates deadline countdown reminders when a verified policy applies.
 */
class RemindersService {
  buildRemindersForReport(report) {
    const policy = report.policyEvaluation || {};
    const reminders = [];

    if (report.submissionStatus === 'NOT_SUBMITTED') {
      if (policy.applicabilityStatus === 'VERIFIED_POLICY_RULE_APPLIED' && policy.hoursRemaining !== null) {
        reminders.push({
          type: 'INITIAL_72_HOUR_INTIMATION_REMINDER',
          urgency: policy.urgencyLevel,
          hoursRemaining: policy.hoursRemaining,
          message: `Verified PMFBY ${policy.intimationDeadlineHours}-hour intimation window: approximately ${Math.round(
            policy.hoursRemaining
          )} hours remaining. Use your prepared draft to call Helpline 14447 or submit via the Crop Insurance App.`,
        });
      } else {
        reminders.push({
          type: 'IMMEDIATE_OFFICIAL_INTIMATION_ADVISORY',
          urgency: 'HIGH',
          hoursRemaining: null,
          message:
            'Your draft is saved, but it has NOT been sent to the government. Please contact Helpline 14447, the Crop Insurance App, or your local Agriculture Office immediately.',
        });
      }
    }

    const missingOptional = ['survey_number', 'application_number'].filter(
      (f) => !report.extractedValues[f] || report.extractedValues[f].value === null
    );
    if (missingOptional.length > 0 && policy.applicabilityStatus === 'VERIFIED_POLICY_RULE_APPLIED') {
      reminders.push({
        type: 'SEVEN_DAY_COMPLETION_REMINDER',
        urgency: 'MODERATE',
        missingFields: missingOptional,
        deadlineIso: policy.sevenDayCompletionDeadlineIso,
        message: `Pending details (${missingOptional.join(
          ', '
        )}) should be completed within the 7-day follow-up provision (${policy.sevenDayCompletionDeadlineIso || 'within 7 days of intimation'}).`,
      });
    }

    return reminders;
  }
}

module.exports = { RemindersService };
