import * as fs from 'fs';
import * as path from 'path';
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import basicSsl from "@vitejs/plugin-basic-ssl";
import shader from 'rollup-plugin-shader';
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";


const __dirname = dirname(fileURLToPath(import.meta.url));
const verge3dRoot = resolve(__dirname, "public/libs/verge3d");
const jsmRoot = resolve(__dirname, "public/libs/jsm");
const iwsdkRoot = resolve(__dirname, "../immersive-web-sdk/packages");

const local_certs = (fs.existsSync('./certs'));

export default {
    base: "",
    build: {
        rollupOptions: {
            input: {
                app: path.resolve(__dirname, './src/main.js'),
                main: path.resolve(__dirname, 'index.html'),
            },
        },
    },
    define: {
       // "process.env.MapboxAccessToken": JSON.stringify(process.env.MapboxAccessToken)
    },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                NodeGlobalsPolyfillPlugin({
                    process: true,
                    buffer: true
                }),
                NodeModulesPolyfillPlugin()
            ]
        }
    },
    resolve: {
        alias: [
            {
                find: "@iwsdk/core",
                replacement: resolve(iwsdkRoot, "core/dist/index.js")
            },
            {
                find: "@iwsdk/xr-input",
                replacement: resolve(iwsdkRoot, "xr-input/dist/index.js")
            },
            {
                find: "@iwsdk/locomotor",
                replacement: resolve(iwsdkRoot, "locomotor/dist/index.js")
            },
            {
                find: "@iwsdk/glxf",
                replacement: resolve(iwsdkRoot, "glxf/dist/index.js")
            },
            // Import maps in public/*.html are not applied during Vite's dep scan;
            // mirror webxr_vr_layers.v3d.html so bare "v3d" / "v3d/addons/*" resolve.
            {
                find: /^v3d\/addons\/(.*)$/,
                replacement: `${jsmRoot}/$1`
            },
            {
                find: "v3d",
                replacement: resolve(verge3dRoot, "build/v3d.module.js")
            },
            {
                find: "./runtimeConfig", replacement: "./runtimeConfig.browser"
            },
            {
                find: "util",
                replacement: "rollup-plugin-node-polyfills/polyfills/util"
            }
        ]
    },
    plugins: (!!local_certs) ? [
        shader({
            // All match files will be parsed by default,
            // but you can also specifically include/exclude files
            include: [
                '**/*.glsl',
                '**/*.vs',
                '**/*.fs'
            ],
            // specify whether to remove comments
            removeComments: true,   // default: true
        })
    ] : [
        /* If certs not available, use basicSsl plugin as workaround for HTTPS */
        basicSsl({
            name: 'test',
        }),
        shader({
            // All match files will be parsed by default,
            // but you can also specifically include/exclude files
            include: [
                '**/*.glsl',
                '**/*.vs',
                '**/*.fs'
            ],
            // specify whether to remove comments
            removeComments: true,   // default: true
        })
    ],
    server: (!!local_certs) ? {
        https: {
            key: fs.readFileSync('certs/privkey.pem'), // make certs symbolic link to dir with certification files
            cert: fs.readFileSync('certs/fullchain.pem'), // make certs symbolic link to dir with certification files
        },
        host: 'dev.real-currents.com', // Allow external access
        port: 5173
    } : {
        https: true // Use in combo with basicSsl plugin; not needed for Vite 5+
    }
};
