/**
 * TurnManager — generic turn rotation over seats.
 * Supports cycles, skipping absent seats, and controlled order (e.g.
 * Baloot follows led suit; engines can override nextSeat()).
 */
export class TurnManager {
  constructor({ seats = [], startAt = 0 } = {}) {
    this.seats = seats; // array of seat numbers in rotation order
    this.index = Math.max(0, this.seats.indexOf(startAt) !== -1 ? this.seats.indexOf(startAt) : 0);
  }

  current() {
    return this.seats[this.index];
  }

  isSeatActive(seat) {
    return this.seats.includes(seat);
  }

  nextSeat(predicate = () => true) {
    const n = this.seats.length;
    for (let step = 1; step <= n; step++) {
      const candidate = this.seats[(this.index + step) % n];
      if (predicate(candidate)) {
        this.index = (this.index + step) % n;
        return this.seats[this.index];
      }
    }
    return this.current();
  }

  advance(predicate) {
    return this.nextSeat(predicate);
  }

  jumpTo(seat) {
    const i = this.seats.indexOf(seat);
    if (i !== -1) this.index = i;
  }

  seatsFrom(seat) {
    const i = this.seats.indexOf(seat);
    if (i === -1) return this.seats;
    return this.seats.slice(i).concat(this.seats.slice(0, i));
  }
}
