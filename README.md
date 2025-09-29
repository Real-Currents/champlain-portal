# Lake Champlain WebXR Portal!
John Hall

This is an attempt to create a grounded immersive experience; an
immersive experience explicitly tied to a real, specific place that
people can visit and verify.

The portal is designed to test whether immersive technology can create
genuine understanding when it connects to a real experience, provides an
embodied understanding and most importantly, remains transparent in its
construction and derivation. Rather than abstract data points, users
experience an actual place - Lake Champlain - through high-quality
stereo video and elevation data. Users can potentially visit this real
location and compare their virtual experience with reality. The
projected wireframe uses real topographic data
(<a href="https://dwtkns.com/srtm30m/" class="external"
target="_blank">SRTM elevation data</a>), allowing users to develop
spatial understanding of an actual geographic area rather than arbitrary
geometric relationships. The stereo video footage that is project onto a
<a href="https://github.com/Real-Currents/webxr-layers-start/"
class="external" target="_blank">WebXR Layer</a> was produced on site,
facilitating a visceral observation of Lake Champlain rather than hiding
the mediation behind seamless interfaces.

The portal serves as an experiment in whether immersive technology can
create shared experiential baselines when grounded in verifiable reality
rather than abstract data. It plays on the question of whether people
experiencing the same real place virtually might develop genuine shared
reference points.

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
