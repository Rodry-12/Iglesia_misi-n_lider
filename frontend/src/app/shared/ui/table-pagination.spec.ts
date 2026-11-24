import { TestBed } from '@angular/core/testing';
import { TablePagination, tablePageSize } from './table-pagination';

describe('TablePagination', () => {
  it('normalizes legacy and invalid sizes to 10', () => {
    for (const value of [null, 25, 30, 100, -1, 'invalid']) expect(tablePageSize(value)).toBe(10);
    for (const value of [10, 20, 50]) expect(tablePageSize(String(value))).toBe(value);
  });
  it('emits server pagination and resets the first row when changing size', () => {
    const fixture = TestBed.createComponent(TablePagination);
    fixture.componentRef.setInput('first', 20);
    fixture.componentRef.setInput('totalRecords', 43);
    const emitted: unknown[] = [];
    fixture.componentInstance.onPageChange.subscribe((value) => emitted.push(value));
    fixture.componentInstance.change(1, 20);
    expect(emitted).toEqual([{ first: 0, rows: 20, page: 0 }]);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentInstance.change(2);
    expect(emitted).toHaveLength(1);
  });
  it('limits the final counter to the total and handles an empty result', () => {
    const fixture = TestBed.createComponent(TablePagination);
    fixture.componentRef.setInput('first', 20);
    fixture.componentRef.setInput('totalRecords', 23);
    expect(fixture.componentInstance.start()).toBe(21);
    expect(fixture.componentInstance.end()).toBe(23);
    fixture.componentRef.setInput('totalRecords', 0);
    expect(fixture.componentInstance.start()).toBe(0);
    expect(fixture.componentInstance.end()).toBe(0);
  });
});
