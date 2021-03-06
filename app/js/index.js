import "whatwg-fetch"

import { template } from "./util"
import { throttle } from "lodash"

const ROVERS = ["curiosity", "spirit", "opportunity"]

let Config = {}
Config.limit = 10

// an object for app state
let State = {}

document.addEventListener("DOMContentLoaded", function init() {
  // start lazy loading the first images right away
  let photos = Array.from(document.querySelectorAll("img.photo"), (img) => lazyLoad(img))

  /**
  * Lazy load initial images in rendered markup
  * @param {Object} img - an array-like list of <img> DOM nodes in the initial index.html
  *
  * @return {Object}
  */
  function lazyLoad(img) {
    img.src = img.dataset.src
    return img
  }

  // event handler where the magic happens
  let scrollHandler = throttle((e) => {
    let up
    // for wheel events
    if (e.deltaY && e.deltaY < 0) up = true
    if (e.deltaY && e.deltaY > 0) up = false
    // for touch events
    if (e.type === "touchmove") {
      if (State.lastX && State.lastX > e.touches[0].clientX) up = true
      if (State.lastX && State.lastX < e.touches[0].clientX) up = false
      State.lastX = e.touches[0].clientY
    }
    changeScene(up)
  }, 500, { leading: true })

  let btnDownHandler = (e) => {
    if (!e.target || !e.target.matches("button.ctrl-btn")) {
      return
    }
    let up = e.target.id === "ctrl-backward" ? true : false
    changeScene(up)
  }

  State.page = 1
  State.rover = 0
  State.tick = false
  State.visible = 0
  State.lastX = undefined
  State.main = document.querySelector("div.wrapper-main")
  State.nodes = Array.from(document.querySelectorAll("div.wrapper-item"))
  State.seen = State.nodes.map((el) => el.dataset.id)

  document.addEventListener("mousewheel", scrollHandler)
  document.addEventListener("DOMMouseScroll", scrollHandler)
  document.addEventListener("touchmove", scrollHandler)

  document.addEventListener("mousedown", btnDownHandler)
  document.addEventListener("mousedown", btnDownHandler)
})

/**
* Fetch images and metadata and append to the DOM
* @param {string} uri - a generator function to run asynchronously
*/
function update(uri) {
  try {
    fetch(uri) // returns a promise for the response
      .then((res) => {
        if (res) return res.json()
      })
      .then((list) => {
        if (!list || list.length < 10) {
          State.rover++
          if (State.rover > ROVERS.length) {
            State.rover = 0
          }
          State.page = 0
          return
        }
        while (list.length) {
          let item = list.shift()
          // do not append duplicates
          if (!~State.seen.indexOf(item.id)) {
            let node = mkNode(item)
            State.main.append(node)
            State.nodes.push(node)
            State.seen.push(item.id)
          }
        }
        State.page++
      })
  } catch (err) {
    console.error(err)
  }
}

/**
* Make new dom nodes with image data
* @param {Boolean} back - true if the previous image should be shown instead of the next image
*
* @return {Object}
*/
function changeScene(back) {
  if (back && State.visible === 0) return // do nothing if someone scrolls up/clicks back right away
  if (!State.tick) {
    window.requestAnimationFrame(function () {
      // manage visible image state
      // first hide the current image
      State.nodes[State.visible].classList.add("hidden")
      // then figure out which one should be shown next
      if (!back) State.visible++
      if (back) State.visible--
      if (State.visible >= State.nodes.length) State.visible = State.nodes.length - 1
      if (State.visible < 0) State.visible = 0
      // now show the correct visible image
      State.nodes[State.visible].classList.remove("hidden")
      // fetch and append new images when scroll is getting close to the end
      if (State.visible >= (State.nodes.length - 10)) {
        let route = mkRoute(ROVERS[State.rover], Config.limit, State.page)
        update(route)
      }
      State.tick = false
    })
  }
  State.tick = true
}

/**
* Make new dom nodes with image data
* @param {Object} data - data for one image container div
*
* @return {Object}
*/
function mkNode(data) {
  let div = document.createElement("div")
  div.classList.add("wrapper-item", "hidden")
  const tmpl = p => template`
  <div class="img-container">
    <img src="${p.img_src}" class="photo"></img>
  </div>
  <div class="metadata">
    <ul>
      <li>image id: ${p.id}</li>
      <li>martian sol: ${p.sol}</li>
      <li>earth date: ${p.earth_date}</li>
      <li>rover: ${p.rover}</li>
      <li>camera: ${p.camera}</li>
      <li><button class="ctrl-btn" type="button" name="backward" id="ctrl-backward">regress</button></li>
      <li><button class="ctrl-btn" type="button" name="forward" id="ctrl-forward">advance</button></li>
    </ul>
  </div>
  `
  div.innerHTML = tmpl(data)
  div.dataset.id = data.id
  return div
}


/**
* Convenience function for building the api route
* @param {String} rover - the rover whose data we want
* @param {String} page - the page of data we want
*
* @return {String}
*/
function mkRoute(rover, limit, page) {
  return `/rover/${rover}/limit/${limit}/page/${page}`
}
