import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import basicSsl from "@vitejs/plugin-basic-ssl";
import shader from 'rollup-plugin-shader';
import * as fs from 'fs';
import * as path from 'path';


const local_certs = (fs.existsSync('./certs'));

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
    server: (!!local_certs) ? {
        https: {
            key: fs.readFileSync('certs/privkey.pem'), // make certs symbolic link to dir with certification files
            cert: fs.readFileSync('certs/fullchain.pem'), // make certs symbolic link to dir with certification files
        },
        host: 'dev.real-currents.com', // Allow external access
        port: 5173
    } : {
        https: true // Use in combo with basicSsl plugin; not needed for Vite 5+
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
