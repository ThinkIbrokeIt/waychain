FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/waychain-explorer .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/waychain-explorer /usr/bin/waychain-explorer
EXPOSE 8080
ENTRYPOINT ["/usr/bin/waychain-explorer"]
