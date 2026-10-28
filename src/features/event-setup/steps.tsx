import { Heart, CakeSlice, UsersRound } from "lucide-react";
import {
  currencies,
  eventTypes,
  type Currency,
  type EventInput,
} from "@/schemas/event";
import {
  budgetCategories,
  eventDescriptions,
  eventLabels,
} from "@/data/templates";
import { addDays, today } from "@/lib/dates";
import { currencyDigits, parseMoney } from "@/features/budget/engine";
import { Field } from "./field";
type EventFieldProps = {
  event: EventInput;
  update: <K extends keyof EventInput>(key: K, value: EventInput[K]) => void;
  errors: Partial<Record<keyof EventInput, string>>;
  inputProps: (
    name: keyof EventInput,
    hint?: boolean,
  ) => {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  };
};
const icons = { wedding: Heart, birthday: CakeSlice, community: UsersRound };
export function OccasionFields({
  event,
  update,
  inputProps,
  errors,
}: EventFieldProps) {
  return (
    <>
      <fieldset className="event-options">
        <legend>Event type</legend>
        {eventTypes.map((type) => {
          const Icon = icons[type];
          return (
            <label
              className={`event-option ${event.eventType === type ? "selected" : ""}`}
              key={type}
            >
              <input
                type="radio"
                name="eventType"
                value={type}
                checked={event.eventType === type}
                onChange={() => {
                  update("eventType", type);
                  update("priorities", []);
                }}
              />
              <Icon size={23} aria-hidden="true" />
              <strong>{eventLabels[type]}</strong>
              <span>{eventDescriptions[type]}</span>
            </label>
          );
        })}
      </fieldset>
      <div className="form-grid">
        <Field name="title" label="Event title" error={errors.title} wide>
          <input
            {...inputProps("title")}
            value={event.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={100}
            placeholder="e.g. Ananya & Aarav’s wedding"
            required
          />
        </Field>
        <Field
          name="subtype"
          label="Occasion subtype (optional)"
          error={errors.subtype}
          wide
        >
          <input
            {...inputProps("subtype")}
            value={event.subtype}
            onChange={(e) => update("subtype", e.target.value)}
            maxLength={80}
            placeholder="e.g. Reception, milestone birthday, cultural gathering"
          />
        </Field>
      </div>
    </>
  );
}

export function EssentialFields({
  event,
  update,
  inputProps,
  errors,
  budgetText,
  setBudgetText,
}: EventFieldProps & {
  budgetText: string;
  setBudgetText: (value: string) => void;
}) {
  return (
    <div className="form-grid">
      <Field
        name="date"
        label="Event date"
        error={errors.date}
        hint="Choose a future date. Planning dates use India Standard Time."
      >
        <input
          {...inputProps("date", true)}
          type="date"
          min={addDays(today(), 1)}
          value={event.date}
          onChange={(e) => update("date", e.target.value)}
          required
        />
      </Field>
      <Field name="city" label="City or location" error={errors.city}>
        <input
          {...inputProps("city")}
          value={event.city}
          maxLength={100}
          onChange={(e) => update("city", e.target.value)}
          placeholder="e.g. Hubballi"
          required
        />
      </Field>
      <Field
        name="guests"
        label="Expected guests"
        error={errors.guests}
        hint="An estimate is perfectly fine. Maximum 10,000."
      >
        <input
          {...inputProps("guests", true)}
          type="number"
          min={1}
          max={10000}
          step={1}
          value={event.guests || ""}
          onChange={(e) => update("guests", Number(e.target.value))}
          required
        />
      </Field>
      <Field
        name="currency"
        label="Currency"
        error={errors.currency}
        hint="Changing currency keeps the entered amount. No conversion."
      >
        <select
          {...inputProps("currency", true)}
          value={event.currency}
          onChange={(e) => {
            const currency = e.target.value as Currency;
            update("currency", currency);
            update("budgetMinor", parseMoney(budgetText, currency) ?? 0);
          }}
        >
          {currencies.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </select>
      </Field>
      <Field
        name="budgetMinor"
        label="Total available budget"
        error={errors.budgetMinor}
        hint={`In ${event.currency}. Includes a 10% contingency. This is a plan, not a price quote.`}
        wide
      >
        <input
          {...inputProps("budgetMinor", true)}
          inputMode={currencyDigits(event.currency) ? "decimal" : "numeric"}
          value={budgetText}
          onChange={(e) => {
            setBudgetText(e.target.value);
            update(
              "budgetMinor",
              parseMoney(e.target.value, event.currency) ?? 0,
            );
          }}
          required
        />
      </Field>
    </div>
  );
}

export function PersonalisationFields({
  event,
  update,
  inputProps,
  errors,
}: EventFieldProps) {
  return (
    <div className="form-grid">
      <Field
        name="style"
        label="Style or theme (optional)"
        error={errors.style}
      >
        <input
          {...inputProps("style")}
          value={event.style}
          maxLength={200}
          onChange={(e) => update("style", e.target.value)}
          placeholder="Traditional, garden party, minimal…"
        />
      </Field>
      <Field name="setting" label="Setting">
        <select
          {...inputProps("setting")}
          value={event.setting}
          onChange={(e) =>
            update("setting", e.target.value as EventInput["setting"])
          }
        >
          <option value="flexible">Open to ideas</option>
          <option value="indoor">Indoors</option>
          <option value="outdoor">Outdoors</option>
        </select>
      </Field>
      <Field
        name="food"
        label="Food preferences (optional)"
        error={errors.food}
      >
        <input
          {...inputProps("food")}
          value={event.food}
          maxLength={200}
          onChange={(e) => update("food", e.target.value)}
          placeholder="Vegetarian, Jain, regional favourites…"
        />
      </Field>
      <Field
        name="culture"
        label="Traditions to consider (optional)"
        error={errors.culture}
      >
        <input
          {...inputProps("culture")}
          value={event.culture}
          maxLength={300}
          onChange={(e) => update("culture", e.target.value)}
          placeholder="Any meaningful cultural details"
        />
      </Field>
      <fieldset className="priority-options field-wide">
        <legend>Top spending priorities (choose up to 3)</legend>
        <div>
          {budgetCategories[event.eventType].map((category) => (
            <label key={category.id}>
              <input
                type="checkbox"
                checked={event.priorities.includes(category.id)}
                disabled={
                  !event.priorities.includes(category.id) &&
                  event.priorities.length >= 3
                }
                onChange={(e) =>
                  update(
                    "priorities",
                    e.target.checked
                      ? [...event.priorities, category.id]
                      : event.priorities.filter((item) => item !== category.id),
                  )
                }
              />
              {category.label}
            </label>
          ))}
        </div>
        {errors.priorities ? (
          <p className="field-error">{errors.priorities}</p>
        ) : null}
      </fieldset>
      <Field
        name="requirements"
        label="Important requirements (optional)"
        error={errors.requirements}
        wide
      >
        <textarea
          {...inputProps("requirements")}
          maxLength={500}
          value={event.requirements}
          onChange={(e) => update("requirements", e.target.value)}
          rows={2}
          placeholder="Step-free access, a quiet space, a rain backup…"
        />
      </Field>
      <Field
        name="notes"
        label="Anything else? (optional)"
        error={errors.notes}
        hint="Avoid guest names, contact details or sensitive personal information."
        wide
      >
        <textarea
          {...inputProps("notes", true)}
          maxLength={1000}
          value={event.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
        />
      </Field>
    </div>
  );
}
