import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionWidget, TxPhase } from './transaction-widget';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { By } from '@angular/platform-browser';

describe('TransactionWidget', () => {
  let fixture: ComponentFixture<TransactionWidget>;
  let component: TransactionWidget;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionWidget],
      providers: [...provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionWidget);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not be busy when idle', () => {
    fixture.componentRef.setInput('phase', 'idle' as TxPhase);
    fixture.detectChanges();
    expect(component['isBusy']()).toBe(false);
  });

  it('should be busy when approving', () => {
    fixture.componentRef.setInput('phase', 'approving' as TxPhase);
    fixture.detectChanges();
    expect(component['isBusy']()).toBe(true);
  });

  it('should be busy when awaitingSignature', () => {
    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    fixture.detectChanges();
    expect(component['isBusy']()).toBe(true);
  });

  it('should be busy when submitting', () => {
    fixture.componentRef.setInput('phase', 'submitting' as TxPhase);
    fixture.detectChanges();
    expect(component['isBusy']()).toBe(true);
  });

  it('should be busy when confirming', () => {
    fixture.componentRef.setInput('phase', 'confirming' as TxPhase);
    fixture.detectChanges();
    expect(component['isBusy']()).toBe(true);
  });

  it('phaseKey returns correct keys', () => {
    fixture.componentRef.setInput('phase', 'approving' as TxPhase);
    expect(component['phaseKey']()).toBe('tx.phaseApproving');

    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    expect(component['phaseKey']()).toBe('tx.phaseAwaitingSignature');

    fixture.componentRef.setInput('phase', 'submitting' as TxPhase);
    expect(component['phaseKey']()).toBe('tx.phaseSubmitting');

    fixture.componentRef.setInput('phase', 'confirming' as TxPhase);
    expect(component['phaseKey']()).toBe('tx.phaseConfirming');

    fixture.componentRef.setInput('phase', 'idle' as TxPhase);
    expect(component['phaseKey']()).toBeNull();
  });

  it('showCancel is true only when cancelable and awaitingSignature', () => {
    fixture.componentRef.setInput('cancelable', true);
    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    fixture.detectChanges();
    expect(component['showCancel']()).toBe(true);

    fixture.componentRef.setInput('phase', 'idle' as TxPhase);
    fixture.detectChanges();
    expect(component['showCancel']()).toBe(false);

    fixture.componentRef.setInput('cancelable', false);
    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    fixture.detectChanges();
    expect(component['showCancel']()).toBe(false);
  });

  it('should emit confirm on confirm button click', () => {
    let emitted = false;
    component.confirm.subscribe(() => { emitted = true; });
    component['onConfirm']();
    expect(emitted).toBe(true);
  });

  it('should emit cancel on cancel button click', () => {
    let emitted = false;
    component.cancel.subscribe(() => { emitted = true; });
    component['onCancel']();
    expect(emitted).toBe(true);
  });

  it('renders progressbar when busy', () => {
    fixture.componentRef.setInput('phase', 'confirming' as TxPhase);
    fixture.detectChanges();
    const pb = fixture.debugElement.query(By.css('p-progressbar'));
    expect(pb).toBeTruthy();
  });

  it('renders phase text when busy and phaseKey is set', () => {
    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('tx.phaseAwaitingSignature');
  });

  it('does not render phase text when idle', () => {
    fixture.componentRef.setInput('phase', 'idle' as TxPhase);
    fixture.detectChanges();
    const pb = fixture.debugElement.query(By.css('p-progressbar'));
    expect(pb).toBeNull();
  });

  it('confirm button click emits confirm event via p-button onClick', () => {
    fixture.componentRef.setInput('phase', 'idle' as TxPhase);
    fixture.detectChanges();
    let emitted = false;
    component.confirm.subscribe(() => { emitted = true; });
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const confirmBtn = pButtons.find(b => !b.attributes['severity'] || b.attributes['severity'] !== 'secondary');
    confirmBtn?.triggerEventHandler('onClick', {});
    expect(emitted).toBe(true);
  });

  it('cancel button click emits cancel event via p-button onClick', () => {
    fixture.componentRef.setInput('cancelable', true);
    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    fixture.detectChanges();
    let emitted = false;
    component.cancel.subscribe(() => { emitted = true; });
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const cancelBtn = pButtons.find(b => b.attributes['severity'] === 'secondary');
    cancelBtn?.triggerEventHandler('onClick', {});
    expect(emitted).toBe(true);
  });
});
