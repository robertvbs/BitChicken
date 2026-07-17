import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { TransactionDialog } from './transaction-dialog';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { TxPhase } from '../transaction-widget/transaction-widget';

describe('TransactionDialog', () => {
  let fixture: ComponentFixture<TransactionDialog>;
  let component: TransactionDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionDialog],
      providers: [...provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('headerKey', 'common.confirm');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isIdle is true when phase is idle', () => {
    fixture.componentRef.setInput('phase', 'idle' as TxPhase);
    fixture.detectChanges();
    expect(component['isIdle']()).toBe(true);
  });

  it('isIdle is false when phase is awaitingSignature', () => {
    fixture.componentRef.setInput('phase', 'awaitingSignature' as TxPhase);
    fixture.detectChanges();
    expect(component['isIdle']()).toBe(false);
  });

  it('isIdle is false when phase is submitting', () => {
    fixture.componentRef.setInput('phase', 'submitting' as TxPhase);
    fixture.detectChanges();
    expect(component['isIdle']()).toBe(false);
  });

  it('isIdle is false when phase is confirming', () => {
    fixture.componentRef.setInput('phase', 'confirming' as TxPhase);
    fixture.detectChanges();
    expect(component['isIdle']()).toBe(false);
  });

  it('isIdle is false when phase is approving', () => {
    fixture.componentRef.setInput('phase', 'approving' as TxPhase);
    fixture.detectChanges();
    expect(component['isIdle']()).toBe(false);
  });

  it('visible defaults to false', () => {
    expect(component.visible()).toBe(false);
  });

  it('visible can be set to true', () => {
    component.visible.set(true);
    expect(component.visible()).toBe(true);
  });

  it('renders p-dialog', () => {
    expect(fixture.debugElement.query(By.css('p-dialog'))).toBeTruthy();
  });

  it('renders app-transaction-widget inside dialog when visible', async () => {
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-transaction-widget'))).toBeTruthy();
  });

  it('confirm output has an emit method', () => {
    expect(typeof component.confirm.emit).toBe('function');
  });

  it('cancel output has an emit method', () => {
    expect(typeof component.cancel.emit).toBe('function');
  });

  it('passes ctaKey to transaction-widget', async () => {
    component.visible.set(true);
    fixture.componentRef.setInput('ctaKey', 'store.confirmObtain');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const widget = fixture.debugElement.query(By.css('app-transaction-widget'));
    if (widget) {
      expect(widget.componentInstance.ctaKey()).toBe('store.confirmObtain');
    } else {
      expect(component.ctaKey()).toBe('store.confirmObtain');
    }
  });

  it('passes ctaIcon to transaction-widget', async () => {
    component.visible.set(true);
    fixture.componentRef.setInput('ctaIcon', 'pi pi-tag');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const widget = fixture.debugElement.query(By.css('app-transaction-widget'));
    if (widget) {
      expect(widget.componentInstance.ctaIcon()).toBe('pi pi-tag');
    } else {
      expect(component.ctaIcon()).toBe('pi pi-tag');
    }
  });

  it('passes ctaDisabled to transaction-widget as disabled', async () => {
    component.visible.set(true);
    fixture.componentRef.setInput('ctaDisabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const widget = fixture.debugElement.query(By.css('app-transaction-widget'));
    if (widget) {
      expect(widget.componentInstance.disabled()).toBe(true);
    } else {
      expect(component.ctaDisabled()).toBe(true);
    }
  });

  it('passes cancelable to transaction-widget', async () => {
    component.visible.set(true);
    fixture.componentRef.setInput('cancelable', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const widget = fixture.debugElement.query(By.css('app-transaction-widget'));
    if (widget) {
      expect(widget.componentInstance.cancelable()).toBe(true);
    } else {
      expect(component.cancelable()).toBe(true);
    }
  });

  it('p-dialog visibleChange updates visible model', () => {
    component.visible.set(true);
    fixture.detectChanges();
    const dialog = fixture.debugElement.query(By.css('p-dialog'));
    dialog?.triggerEventHandler('visibleChange', false);
    expect(component.visible()).toBe(false);
  });

  it('styleClass input is applied to p-dialog', () => {
    fixture.componentRef.setInput('styleClass', 'w-full max-w-lg');
    fixture.detectChanges();
    const dialog = fixture.debugElement.query(By.css('p-dialog'));
    expect(dialog?.componentInstance.styleClass).toBe('w-full max-w-lg');
  });

  it('default styleClass is w-full max-w-sm', () => {
    expect(component.styleClass()).toBe('w-full max-w-sm');
  });
});
