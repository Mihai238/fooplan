import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TABBABLE } from '../testing';
import { PicturePlaceholder } from './picture-placeholder';
import { pictureShape, PLACEHOLDER } from './testing';

// In a p, as in a picked meal's p.recipe: a div written straight into a p would close it at compile
// time, one in an @if block doesn't
@Component({
  imports: [PicturePlaceholder],
  template: '<p>@if (true) {<div appPicturePlaceholder></div>}</p>',
})
class Host {}

describe('PicturePlaceholder', () => {
  it('makes its div a div.picture.placeholder holding only the hidden plate svg, with no text (#63)', () => {
    expect(pictureShape(placeholder())).toEqual(PLACEHOLDER);
  });

  it('draws the plate in a 0 0 24 24 viewBox: one circle of radius 10 and two paths for the fork and the knife, stroked in currentColor, with no title or text (#63)', () => {
    const svg = placeholder().querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(Array.from(svg.children).map((child) => child.tagName.toLowerCase())).toEqual([
      'circle',
      'path',
      'path',
    ]);
    expect(svg.querySelectorAll('circle[r="10"]')).toHaveLength(1);
    expect(svg.querySelectorAll('title, text')).toHaveLength(0);
  });

  it('hides the plate from assistive technology and makes nothing focusable: aria-hidden and focusable="false" on the svg, nothing tabbable in or on the div (#63)', () => {
    const div = placeholder();
    const svg = div.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(div.matches(TABBABLE)).toBe(false);
    expect(div.querySelectorAll(TABBABLE)).toHaveLength(0);
  });

  function placeholder(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('p > div')!;
  }
});
