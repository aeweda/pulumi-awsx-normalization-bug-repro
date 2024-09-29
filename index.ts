import sortKeys from "sort-keys";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { Clusters } from "./clusters";

//? ///////////////////////////////////////
//?       Create General Resources       //
//? //////////////////////////////////// //
const Vpc = new aws.ec2.Vpc("generalVpc", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: "myVpc",
    },
});

const Subnet = new aws.ec2.Subnet("generalSubnet", {
    vpcId: Vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "us-east-2a",
    tags: {
        Name: "generalSubnet",
    },
}, { dependsOn: [Vpc] });

const SecurityGroup = new aws.ec2.SecurityGroup("generalSecurityGroup", {
    vpcId: Vpc.id,
    description: "Allow SSH traffic",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
    tags: {
        Name: "generalSecurityGroup",
    },
}, { dependsOn: Vpc });

//! //////////////////////////////////// //
//!           Loop & Create              //
//!             Clusters                 //
//! //////////////////////////////////// //
for(let cluster in Clusters) {
    //? //////////////////////////////////// //
    //?                 Data                 //
    //? //////////////////////////////////// //
    const Name = cluster;
    const Data = Clusters[cluster];
    const ContaineraEnvars = sortKeys(Data.containera.envars, {deep: true})
    const ContainerbEnvars = sortKeys(Data.containerb.envars, {deep: true})


    //? //////////////////////////////////// //
    //?               Cluster                //
    //? //////////////////////////////////// //
    const Cluster = new aws.ecs.Cluster(Name, {
        settings: [
            {
                name: "containerInsights",
                value: "disabled"
            }
        ]
    }, { dependsOn: [SecurityGroup, Subnet] });


    //? //////////////////////////////////// //
    //?            Launch Template           //
    //? //////////////////////////////////// //
    const LaunchTemplate = new aws.ec2.LaunchTemplate(`${Name}-Launch-Template`, {
        imageId: "ami-0b0033935e98632de",
        instanceType: "t3.medium",
        blockDeviceMappings: [{
            deviceName: "/dev/sda1",
            ebs: {
                iops: 3000,
                volumeSize: 30,
                throughput: 125,
                volumeType: "gp3",
                deleteOnTermination: "true",
            }
        }],
        networkInterfaces: [{
            associatePublicIpAddress: "true",
            securityGroups: [SecurityGroup.id],
            subnetId: Subnet.id,
        }],
        instanceMarketOptions: {
            marketType: "spot",
            spotOptions: {
                maxPrice: "0.022",
            }
        },
        updateDefaultVersion: true,
        userData: Cluster.name.apply(name => {
            const RawUserData  = `#!/bin/bash \n
            echo ECS_LOGLEVEL=debug >> /etc/ecs/ecs.config \n
            echo ECS_ENABLE_TASK_IAM_ROLE=true >> /etc/ecs.config \n
            echo ECS_CLUSTER=${name} >> /etc/ecs/ecs.config \n
            echo ECS_ENABLE_CONTAINER_METADATA=true >> /etc/ecs/ecs.config \n
            echo ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE=true >> /etc/ecs/ecs.config \n
            echo ECS_AVAILABLE_LOGGING_DRIVERS=[\\"awslogs\\",\\"fluentd\\",\\"json-file\\"] >> /etc/ecs/ecs.config \n
            `
            const UserData = Buffer.from(RawUserData, 'utf8').toString('base64')
            return UserData
        })
    }, { dependsOn: [Cluster] });


    //? //////////////////////////////////// //
    //?           AutoScaling Group          //
    //? //////////////////////////////////// //
    const AutoScalingGroup = new aws.autoscaling.Group(Name, {
        availabilityZones: [ "us-east-2a" ],
        launchTemplate: {
            id: LaunchTemplate.id
        },
        desiredCapacity: 0,
        minSize: 0,
        maxSize: 0,
        tags:[{
            key: "Name",
            value: `${Name}`,
            propagateAtLaunch: true
        }]
    }, { dependsOn: [LaunchTemplate, Subnet, SecurityGroup] });


    //? //////////////////////////////////// //
    //?          Capacity Provider           //
    //? //////////////////////////////////// //
    const CapacityProvider = new aws.ecs.CapacityProvider(Name, {
        autoScalingGroupProvider: {
            autoScalingGroupArn: AutoScalingGroup.arn,
            managedTerminationProtection: "DISABLED",
        }
    });

    new aws.ecs.ClusterCapacityProviders(Name, {
       clusterName: Cluster.name,
       capacityProviders: [ CapacityProvider.name ]
    });


    //? //////////////////////////////////// //
    //?           Log Configuration          //
    //? //////////////////////////////////// //
    const LogConfiguration = { logConfiguration: {
        logDriver: "awsfirelens",
        options: {
            Name: "grafana-loki",
            Url: "https://asdsadasdsad:asdsadsadasd9@loki.whatever.ai/loki/api/v1/push",
            Labels: `{job=\"${Name}\"}`,
            RemoveKeys: "container_id,ecs_task_arn",
            LabelKeys: "container_name,ecs_task_definition,source,ecs_cluster",
            LineFormat: "key_value"
        }
    }}


    //? //////////////////////////////////// //
    //?           Task Definition            //
    //? //////////////////////////////////// //
    const TaskDefinition = new awsx.ecs.EC2TaskDefinition(Name, {
        networkMode: "bridge",
        containers: {
            logrouter: {
                name: "logrouter",
                essential: true,
                image: "grafana/fluent-bit-plugin-loki:2.6.1-amd64",
                memoryReservation: 127,
                firelensConfiguration: {
                    type: "fluentbit",
                    options: {
                        "enable-ecs-log-metadata": "true"
                    }
                },
                environment: [],
                mountPoints: [],
                portMappings: [],
                user: "0"
            },
            containera: {
                name: "containera",
                essential: true,
                image: `alpine:latest`,
                memoryReservation: 224,
                command: Data.containera.command,
                environment: ContaineraEnvars,
                dependsOn: [{
                    containerName: "logrouter",
                    condition: "START"
                }],
                ...LogConfiguration,
                mountPoints: [],
            },
            containerb: {
                name: "containerb",
                essential: false,
                image: `alpine:latest`,
                memoryReservation: 224,
                command: Data.containerb.command,
                environment: ContainerbEnvars,
                dependsOn: [{
                    containerName: "containera",
                    condition: "START"
                }],
                mountPoints: [],
                portMappings: []
            },
        },
        volumes: [],
    }, { dependsOn: [SecurityGroup, Subnet]});

    //? //////////////////////////////////// //
    //?           Cluster Service            //
    //? //////////////////////////////////// //
    // ! Create Cluster Service
    new aws.ecs.Service(Name, {
        cluster: Cluster.arn,
        desiredCount: 1,
        deploymentMinimumHealthyPercent: 0,
        taskDefinition: TaskDefinition.taskDefinition.arn,
        capacityProviderStrategies:[{
            capacityProvider: CapacityProvider.name,
            base: 1,
            weight: 1,
        }],
    }, { dependsOn: [Cluster, CapacityProvider, AutoScalingGroup, Subnet, SecurityGroup] });
}
