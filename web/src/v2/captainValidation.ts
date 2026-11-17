export type CaptainPersonalField =
  | 'fullName'
  | 'phone'
  | 'professionalBackground'
  | 'experienceYears';

export type CaptainFieldError = 'required' | 'invalid';

export type CaptainPersonalDetails = {
  fullName: string;
  phone: string;
  professionalBackground: string;
  experienceYears: string;
};

export type CaptainVehicleField =
  | 'vehicleType'
  | 'makeId'
  | 'modelId'
  | 'year'
  | 'colorCode'
  | 'colorOther'
  | 'plate';

export type CaptainVehicleDetails = {
  vehicleType: string;
  makeId: string;
  modelId: string;
  year: string;
  colorCode: string;
  colorOther: string;
  plate: string;
};

export function normalizeNumerals(value: string): string {
  return value
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
}

export function canonicalEgyptianPlate(input: string): string {
  // Ordinary plates: Cairo 3 letters/3 digits, Giza 2 letters/4 digits,
  // other governorates 3 letters/4 digits. Accept either visual ordering.
  const value = normalizeNumerals(input).replace(/[\s-]+/g, '').toUpperCase();
  const backwards = value.match(/^([0-9]{3,4})([ء-ي]{2,3})$/u);
  return backwards ? backwards[2] + backwards[1] : value;
}

export function captainPersonalErrors(
  details: CaptainPersonalDetails,
): Partial<Record<CaptainPersonalField, CaptainFieldError>> {
  const errors: Partial<Record<CaptainPersonalField, CaptainFieldError>> = {};
  const name = details.fullName.trim();
  const phone = normalizeNumerals(details.phone).replace(/[\s-]/g, '');
  const background = details.professionalBackground.trim();
  const years = normalizeNumerals(details.experienceYears.trim());

  if (!name) errors.fullName = 'required';
  else if (name.length < 5 || name.split(/\s+/).length < 3) errors.fullName = 'invalid';

  if (!phone) errors.phone = 'required';
  else if (!/^01[0125]\d{8}$/.test(phone)) errors.phone = 'invalid';

  if (!background) errors.professionalBackground = 'required';
  else if (background.length < 15 || background.split(/\s+/).length < 3 || background.length > 1000)
    errors.professionalBackground = 'invalid';

  if (!years) errors.experienceYears = 'required';
  else {
    const number = Number(years);
    if (!Number.isInteger(number) || number < 0 || number > 30)
      errors.experienceYears = 'invalid';
  }

  return errors;
}

export function captainVehicleErrors(
  details: CaptainVehicleDetails,
  currentYear: number,
): Partial<Record<CaptainVehicleField, CaptainFieldError>> {
  const errors: Partial<Record<CaptainVehicleField, CaptainFieldError>> = {};
  const year = Number(details.year);
  const plate = canonicalEgyptianPlate(details.plate);

  if (!details.vehicleType) errors.vehicleType = 'required';
  else if (!['private_car', 'hiace'].includes(details.vehicleType))
    errors.vehicleType = 'invalid';

  if (!details.makeId) errors.makeId = 'required';
  if (!details.modelId) errors.modelId = 'required';

  if (!details.year) errors.year = 'required';
  else if (!Number.isInteger(year) || year < 1980 || year > currentYear)
    errors.year = 'invalid';

  if (!details.colorCode) errors.colorCode = 'required';
  if (details.colorCode === 'other' && details.colorOther.trim().length < 2)
    errors.colorOther = details.colorOther.trim() ? 'invalid' : 'required';

  if (!plate) errors.plate = 'required';
  else if (!/^([ء-ي]{3}[0-9]{3}|[ء-ي]{2}[0-9]{4}|[ء-ي]{3}[0-9]{4})$/u.test(plate))
    errors.plate = 'invalid';

  return errors;
}
