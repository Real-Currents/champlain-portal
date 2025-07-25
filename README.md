# WebXR Layers Start!
John Hall

This is a simple boostrap repo for a WebXR Layers project. I’ve seen some examples where
developers in-the-know effortlessly incorporate WebXR Layers into their
app, some of which are sampled here, but I haven’t come across any
demonstrating a practical boiler plate and usage of WebXR Layers. This
is my attempt…

## Configuration

This project uses vite to build/bundle/package/etc. the WebXR app. The
`vite.config.js` configuration also depends on the
`@vitejs/plugin-basic-ssl` plugin so that the dev server will use the
HTTPS protocol which is required for entering immersive mode on most web
browsers. Install all required dependencies with `npm install`

## Running Code

Run `npm run dev` to run the WebXR dev server.


      VITE v5.4.11  ready in 293 ms

      ➜  Local:   https://localhost:5173/
      ➜  Network: use --host to expose
      ➜  press h + enter to show help

<hr />

## Original changes to [WebXR&nbsp:Live&nbsp:Coding](https://mrdoob.github.io/xrcode/)

> I’ve seen many people trying to do this on the Quest but always
> getting blocked for one reason or another. I had to give it a go
> myself.
>
> Kudos to the one that started it all:
> [RiftSketch](https://www.youtube.com/watch?v=db-7J5OaSag) 🙏
>
> ------------------------------------------------------------------------
>
> #### Updates
>
> July 6, 2021
>
> - Switch to [WebXR Layers](https://www.w3.org/TR/webxrlayers-1/) for
>   improved text quality.
>
> September 11, 2020
>
> - Added apartment scene
>
> May 22, 2020
>
> - Added error console
>
> May 21, 2020
>
> - Made sketches clonable (squeeze button)
> - Made sketches draggable
> - First release
