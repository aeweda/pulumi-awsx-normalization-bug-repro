import { Configs } from "./types";

export const Clusters: Configs = {
    "clustera": {
        containera: {
            version: "latest",
            command: ["sleep", "1000"],
            envars: [
                {
                    name: "SOME_ENVB",
                    value: "true"
                },
                {
                    name: "SOME_ENVA",
                    value: "true"
                },
            ],
        },
        containerb: {
            version: "latest",
            command: ["sleep", "1000"],
            envars: [
                {
                    name: "SOME_ENVB",
                    value: "true"
                },
                {
                    name: "SOME_ENVA",
                    value: "true"
                },
            ]
        },
    },
    "clusterb": {
        containera: {
            version: "latest",
            command: ["sleep", "1000"],
            envars: [
                {
                    name: "SOME_ENVB",
                    value: "true"
                },
                {
                    name: "SOME_ENVA",
                    value: "true"
                },
            ],
        },
        containerb: {
            version: "latest",
            command: ["sleep", "1000"],
            envars: [
                {
                    name: "SOME_ENVB",
                    value: "true"
                },
                {
                    name: "SOME_ENVA",
                    value: "true"
                },
            ]
        },
    },
}
