# BR-10 — Owner date of birth

**Status:** Ready on our side — the field and the field-level error both work; the backend has to return the error

## The requirement

> The owner's Date of Birth is optional. When a value is entered, it must not make the
> owner younger than 18 years on the day of saving. The Save action is blocked with a
> field-level error until the value is corrected or cleared.

## How it works today

The form has a date field and shows a field-level error when one comes back. Nothing here
is missing on our side; the field is simply not in the form the backend returns yet.

## Backend — what the API must return

The date property, and the rule enforced on save: reject a value that would make the owner
younger than eighteen on the day of saving, and return the error **against the field**, so
the form puts it under Date of Birth rather than anywhere else. Save stays blocked until
the value is corrected or cleared.

The shape of that response is documented here: [Forms API — returning server validation
errors](https://docs.applicaster.com/integrations/forms-api#returning-server-validation-errors).

The form config has no minimum or maximum date, so the check does not run as the value is
typed — it runs on save, which is where enforcement belongs anyway. A form config is not
enforcement.

## Where the contract is

[Section 6, Addition 6](../contract/aioc-pin-feeds-spec.md#addition-6--date-of-birth) of the feed contract: optional for the
owner, required for a child, and Save blocked while the value would make the owner younger
than eighteen.
