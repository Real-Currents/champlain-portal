import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import basicSsl from "@vitejs/plugin-basic-ssl";
import shader from 'rollup-plugin-shader';
import * as path from 'path';

const threeAddons = path.resolve(__dirname, 'node_modules/three/examples/jsm');

export default {
    base: "",
    build: {
        rollupOptions: {
            input: {
                app: path.resolve(__dirname, './src/main.js'),
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
            // Official npm `three` exposes `three/addons/*`; GitHub forks often only ship `examples/jsm`.
            {
                find: /^three\/addons\/(.+)$/,
                replacement: `${threeAddons}/$1`
            },
            // {
            //     find: "@", replacement: resolve(__dirname, "./src"),
            // },
            {
                find: "./runtimeConfig", replacement: "./runtimeConfig.browser"
            },
            {
                find: "util",
                replacement: "rollup-plugin-node-polyfills/polyfills/util"
            }
        ]
    },
    server: { https: true }, // Not needed for Vite 5+
    plugins: [
        basicSsl({
            /** name of certification */
            name: 'test',
            // /** custom trust domains */
            // domains: ['*.custom.com'],
            // /** custom certification directory */
            // certDir: '/Users/.../.devServer/cert'
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
    ]
};
