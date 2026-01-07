/**
 * Domain types for slot calculation
 */

/**
 * Represents a time slot available for booking
 */
export interface SlotOutput {
    startAt: string // ISO 8601 string in UTC
    endAt: string // ISO 8601 string in UTC (startAt + duration)
    displayTime: string // Human-readable time in business timezone (e.g., "14:30")
}

/**
 * Availability rule for slot calculation (subset of AvailabilityRule entity)
 */
export interface AvailabilityRuleInput {
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
    startMinutes: number
    endMinutes: number
}

/**
 * Input for slot calculation
 */
export interface CalculateSlotsInput {
    businessTimezone: string // IANA timezone (e.g., "America/Argentina/Buenos_Aires")
    fromDate: Date // Start of range (UTC)
    toDate: Date // End of range (UTC)
    durationMinutes: number // Service duration
    bufferMinutes: number // Service buffer
    availabilityRules: AvailabilityRuleInput[] // Weekly availability
    blocks: BlockInterval[] // Punctual blocks
    appointments: AppointmentInterval[] // Existing appointments (occupied_end_at)
}

/**
 * A block interval (from resource_blocks table)
 */
export interface BlockInterval {
    startAt: Date // UTC
    endAt: Date // UTC
}

/**
 * An appointment interval (from appointments table)
 */
export interface AppointmentInterval {
    startAt: Date // UTC
    occupiedEndAt: Date // UTC (endAt + buffer)
}

/**
 * Constants
 */
export const DURATION_STEP = 5 // Slots are generated every 5 minutes
export const MAX_DAYS_AHEAD = 30 // Maximum range for slot calculation
