import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageFallbackDirective } from './image-fallback.directive';

@Component({
  template: `<img src="test.png" appImageFallback alt="test" />`,
  imports: [ImageFallbackDirective],
})
class TestHostComponent {}

describe('ImageFallbackDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should create the host component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('replaces src with placeholder data URI on error event', () => {
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img.getAttribute('src')).toBe(ImageFallbackDirective.PLACEHOLDER_DATA_URI);
  });

  it('adds bc-img-broken class on error', () => {
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img.classList.contains('bc-img-broken')).toBe(true);
  });

  it('does nothing when event target is null', () => {
    const directive = new ImageFallbackDirective();
    const event = { target: null } as unknown as Event;
    expect(() => directive.onError(event)).not.toThrow();
  });

  it('does nothing when target has no setAttribute method', () => {
    const directive = new ImageFallbackDirective();
    const event = { target: { style: {} } } as unknown as Event;
    expect(() => directive.onError(event)).not.toThrow();
  });
});
