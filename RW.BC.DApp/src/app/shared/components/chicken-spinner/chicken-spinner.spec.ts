import { TestBed } from '@angular/core/testing';
import { ChickenSpinner } from './chicken-spinner';

describe('ChickenSpinner', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChickenSpinner],
    }).compileComponents();
  });

  it('renders the pixel chicken with legs and exposes a status role', () => {
    const fixture = TestBed.createComponent(ChickenSpinner);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('status');
    expect(host.querySelector('.bc-chick__body')).toBeTruthy();
    expect(host.querySelectorAll('.bc-chick__leg').length).toBe(2);
  });

  it('reflects the label input into aria-label', () => {
    const fixture = TestBed.createComponent(ChickenSpinner);
    fixture.componentRef.setInput('label', 'Hatching…');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-label')).toBe('Hatching…');
  });
});
