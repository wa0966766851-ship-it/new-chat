/*! Blockly 13.2.1 — Copyright Google LLC; Apache-2.0. See LICENSE.txt and build-info.json. */
import{x as o,a0 as e,$ as r,a1 as n}from"./core-02.js";import{a3 as a,cc as c,bW as p}from"./core-00.js";export{cd as setLocale}from"./core-00.js";import{W as m,B as T}from"./core-04.js";import{P as f,a8 as u,R as w}from"./core-01.js";export{a9 as Events,a5 as Theme}from"./core-01.js";import{T as E}from"./core-05.js";export{t as Themes,i as inject,s as serialization}from"./core-05.js";import{W as j}from"./core-03.js";import"./core-06.js";
/**
 * @license
 * Copyright 2011 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
a.INPUT_VALUE,a.OUTPUT_VALUE,a.NEXT_STATEMENT,a.PREVIOUS_STATEMENT,f.TOP,f.BOTTOM,f.LEFT,f.RIGHT;const h=p,l=c;j.prototype.newBlock=function(e,t){return new o(this,e,t)},m.prototype.newBlock=function(o,e){return new T(this,o,e)},j.prototype.newComment=function(o){return new u(this,o)},m.prototype.newComment=function(o){return new w(this,o)},m.newTrashcan=function(o){return new E(o)},e.prototype.newWorkspaceSvg=function(o){return new m(o)},r.prototype.populateProcedures=function(o){const e=n(o),t=e[0].concat(e[1]);for(let o=0;o<t.length;o++)this.getName(t[o][0],r.NameType.PROCEDURE)};export{j as Workspace,l as defineBlocksWithJsonArray,h as svgResize};
