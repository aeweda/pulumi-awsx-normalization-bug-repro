import { Input } from "@pulumi/pulumi";
import { ecs } from "@pulumi/awsx/types/input";


export type Configs = {
    [cluster: string]: {
        containera: ContainerData,
        containerb: ContainerData,
    }
}

export type ContainerData = {
    version: string;
    command?: Input<string[]>;
    envars: ecs.TaskDefinitionKeyValuePairArgs[];
}
